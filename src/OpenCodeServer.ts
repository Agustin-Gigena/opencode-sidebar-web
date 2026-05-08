import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { platform, arch } from 'os';

const CSP_HEADERS = [
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
];

const PORT_REGEX = /listening on https?:\/\/[^:]+:(\d+)/i;

export class OpenCodeServer {
  private process: ChildProcess | null = null;
  private proxy: http.Server | null = null;
  private _port: number = 0;
  private _proxyPort: number = 0;
  private _hostname: string = '127.0.0.1';
  private _isRunning: boolean = false;
  private _processExited: boolean = false;
  private _processExitCode: number | null = null;
  private _processError: string = '';
  private _outputBuffer: string = '';
  private _outputChannel: vscode.OutputChannel;
  private _statusBarItem: vscode.StatusBarItem;
  private _onDidChangeStatus = new vscode.EventEmitter<boolean>();
  readonly onDidChangeStatus = this._onDidChangeStatus.event;

  constructor(context: vscode.ExtensionContext) {
    this._outputChannel = vscode.window.createOutputChannel('OpenCode Server');

    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left, 100
    );
    this._statusBarItem.command = 'opencode-sidebar-web.focusPanel';
    context.subscriptions.push(this._statusBarItem, this._outputChannel);
    this.updateStatusBar();
  }

  get port(): number { return this._port; }
  get proxyPort(): number { return this._proxyPort; }
  get hostname(): string { return this._hostname; }
  get isRunning(): boolean { return this._isRunning; }
  get serverUrl(): string { return `http://${this._hostname}:${this._port}`; }
  get proxyUrl(): string { return `http://${this._hostname}:${this._proxyPort}`; }
  get lastError(): string { return this._processError; }
  get lastExitCode(): number | null { return this._processExitCode; }
  get outputChannel(): vscode.OutputChannel { return this._outputChannel; }

  private findBinary(): string {
    const nodeModules = path.join(__dirname, '..', 'node_modules');

    const plat = platform() === 'win32' ? 'windows' : platform() === 'darwin' ? 'darwin' : 'linux';
    const archName = arch();
    const binaryName = plat === 'windows' ? 'opencode.exe' : 'opencode';

    const candidates = [
      path.join(nodeModules, `opencode-${plat}-${archName}`, 'bin', binaryName),
      path.join(nodeModules, `opencode-${plat}-${archName}-baseline`, 'bin', binaryName),
      path.join(nodeModules, `opencode-${plat}-${archName}-musl`, 'bin', binaryName),
      path.join(nodeModules, `opencode-${plat}-${archName}-baseline-musl`, 'bin', binaryName),
    ];

    for (const c of candidates) {
      try { fs.accessSync(c, fs.constants.X_OK); return c; } catch { /* try next */ }
    }

    const wrapper = path.join(nodeModules, '.bin', 'opencode');
    if (fs.existsSync(wrapper)) { return wrapper; }
    const winWrapper = wrapper + '.cmd';
    if (fs.existsSync(winWrapper)) { return winWrapper; }

    return 'opencode';
  }

  async start(): Promise<void> {
    if (this._isRunning) { return; }

    this._processExited = false;
    this._processError = '';
    this._outputBuffer = '';
    this._port = 0;

    this._hostname = vscode.workspace.getConfiguration('opencode-sidebar-web')
      .get('hostname', '127.0.0.1');

    const binary = this.findBinary();
    this._outputChannel.appendLine(`Starting OpenCode server...`);
    this._outputChannel.appendLine(`Binary: ${binary}`);

    this._outputChannel.appendLine(
      `Run manually to debug: ${binary} serve --port 0 --hostname ${this._hostname}`
    );

    const args = ['serve', '--port', '0', '--hostname', this._hostname];

    this.process = spawn(binary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        OPENCODE_SERVER_PASSWORD: process.env.OPENCODE_SERVER_PASSWORD || '',
      },
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleOutput(data.toString());
    });
    this.process.stderr?.on('data', (data: Buffer) => {
      this.handleOutput(data.toString());
    });

    this.process.on('error', (err) => {
      this._processError = err.message;
      this._outputChannel.appendLine(`Process error: ${err.message}`);
      this.cleanup();
    });

    this.process.on('exit', (code) => {
      this._processExited = true;
      this._processExitCode = code;
      this._outputChannel.appendLine(`Process exited with code ${code}`);
      this.cleanup();
    });

    await this.waitForServer();
    await this.startProxy();

    this._isRunning = true;
    this.updateStatusBar();
    this._onDidChangeStatus.fire(true);
    this._outputChannel.appendLine(`Server ready at ${this.serverUrl}`);
  }

  private handleOutput(text: string): void {
    this._outputChannel.append(text);
    this._outputBuffer += text;

    if (this._port === 0) {
      const match = this._outputBuffer.match(PORT_REGEX);
      if (match) {
        this._port = parseInt(match[1], 10);
        this._outputChannel.appendLine(`\nDetected port: ${this._port}`);
      }
    }
  }

  private cleanup(): void {
    this._isRunning = false;
    this.process = null;
    this.stopProxy();
    this.updateStatusBar();
    this._onDidChangeStatus.fire(false);
  }

  private async waitForServer(timeout = 30000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (this._processExited) {
        const reason = this._processError
          ? `Error: ${this._processError}`
          : `Exit code: ${this._processExitCode}`;
        const lastLog = this._outputBuffer.slice(-300);
        throw new Error(
          `Process exited prematurely (${reason}). Last output: ${lastLog}`
        );
      }

      if (this._port === 0) {
        await this.sleep(200);
        continue;
      }

      try {
        const response = await fetch(`${this.serverUrl}/global/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          return;
        }
      } catch {
        await this.sleep(500);
      }
    }

    const reason = this._processExited
      ? 'Process exited before ready'
      : this._port === 0
        ? 'Could not detect server port from output'
        : 'Health check did not respond';

    throw new Error(`Server did not start within timeout (${reason})`);
  }

  private async startProxy(): Promise<void> {
    return new Promise((resolve) => {
      this.proxy = http.createServer((req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400',
          });
          res.end();
          return;
        }

        const targetUrl = `${this.serverUrl}${req.url}`;
        const proxyReq = http.request(targetUrl, {
          method: req.method,
          headers: { ...req.headers, host: `127.0.0.1:${this._port}` },
        }, (proxyRes) => {
          const headers = { ...proxyRes.headers };
          for (const h of CSP_HEADERS) { delete headers[h]; }
          res.writeHead(proxyRes.statusCode || 200, {
            ...headers,
            'Access-Control-Allow-Origin': '*',
            'access-control-expose-headers': '*',
          });
          proxyRes.pipe(res);
        });
        proxyReq.on('error', () => {
          res.writeHead(502);
          res.end('Bad Gateway');
        });
        req.pipe(proxyReq);
      });

      this.proxy.listen(0, '127.0.0.1', () => {
        const addr = this.proxy!.address();
        if (addr && typeof addr === 'object') {
          this._proxyPort = addr.port;
        }
        this._outputChannel.appendLine(
          `Proxy listening on http://127.0.0.1:${this._proxyPort}`
        );
        resolve();
      });
    });
  }

  private stopProxy(): void {
    if (this.proxy) { this.proxy.close(); this.proxy = null; }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    if (!this.process && !this._isRunning) { return; }
    this._outputChannel.appendLine('Stopping OpenCode server...');

    try {
      await fetch(`${this.serverUrl}/instance/dispose`, {
        method: 'POST', signal: AbortSignal.timeout(5000),
      });
    } catch { /* ignore */ }

    this.stopProxy();

    if (this.process?.pid) {
      const pid = this.process.pid;
      try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }
    }

    await this.sleep(1000);
    this.cleanup();
    this._outputChannel.appendLine('Server stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.sleep(500);
    await this.start();
  }

  async dispose(): Promise<void> {
    await this.stop();
    this._statusBarItem.dispose();
    this._outputChannel.dispose();
    this._onDidChangeStatus.dispose();
  }

  private updateStatusBar(): void {
    if (this._isRunning) {
      this._statusBarItem.text = '$(globe) OpenCode: Connected';
      this._statusBarItem.backgroundColor = undefined;
      this._statusBarItem.tooltip = `OpenCode running on port ${this._port}`;
      this._statusBarItem.show();
    } else {
      this._statusBarItem.text = '$(globe) OpenCode: Disconnected';
      this._statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
      this._statusBarItem.tooltip = 'Click to open OpenCode panel';
      this._statusBarItem.show();
    }
  }
}
