import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { createPlatformManager } from './platform/PlatformManager.js';
import { GitHubAPI } from './GitHubAPI.js';

const CSP_HEADERS = [
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
];

const PORT_REGEX = /listening on https?:\/\/[^:]+:(\d+)/i;
const HEALTH_ENDPOINT = '/global/health';

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
  private _extensionPath: string;
  private _storagePath: string;
  private _webviewUrl: string = '';

  constructor(context: vscode.ExtensionContext) {
    this._extensionPath = context.extensionPath;
    this._storagePath = context.globalStorageUri?.fsPath
      || context.storageUri?.fsPath
      || path.join(context.extensionPath, '.storage');
    fs.mkdirSync(this._storagePath, { recursive: true });
    this._outputChannel = vscode.window.createOutputChannel('OpenCode Server');

    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left, 100
    );
    this._statusBarItem.command = 'opencode-sidebar-web.focusPanel';
    context.subscriptions.push(this._statusBarItem, this._outputChannel);
    this.updateStatusBar();
  }

  isRemoteEnvironment(): boolean {
    return vscode.env.remoteName !== undefined;
  }

  private async resolveWebviewUrl(): Promise<void> {
    if (this.isRemoteEnvironment() && this._proxyPort > 0) {
      const candidates = [
        `http://localhost:${this._proxyPort}`,
        `http://127.0.0.1:${this._proxyPort}`,
      ];
      for (const uriText of candidates) {
        const localUri = vscode.Uri.parse(uriText);
        try {
          this._outputChannel.appendLine(`Resolving remote URI for proxy at ${uriText}`);
          const external = await vscode.env.asExternalUri(localUri);
          this._webviewUrl = external.toString();
          this._outputChannel.appendLine(`Resolved external URI: ${this._webviewUrl}`);
          return;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this._outputChannel.appendLine(
            `asExternalUri failed for ${uriText}: ${message}`
          );
        }
      }
      this._outputChannel.appendLine(
        'Failed to resolve external URI for remote proxy; keeping local proxy URL.'
      );
      this._webviewUrl = `http://127.0.0.1:${this._proxyPort}`;
    } else if (this._proxyPort > 0) {
      this._webviewUrl = `http://${this._hostname}:${this._proxyPort}`;
    } else if (!this._webviewUrl) {
      this._webviewUrl = this.proxyUrl;
    }
  }

  private isExecutableFile(filePath: string): boolean {
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  get port(): number { return this._port; }
  get proxyPort(): number { return this._proxyPort; }
  get hostname(): string { return this._hostname; }
  get isRunning(): boolean { return this._isRunning; }
  get serverUrl(): string { return `http://${this._hostname}:${this._port}`; }
  get proxyUrl(): string { return `http://${this._hostname}:${this._proxyPort}`; }
  get webviewUrl(): string { return this._webviewUrl || this.proxyUrl; }
  get lastError(): string { return this._processError; }
  get lastExitCode(): number | null { return this._processExitCode; }
  get outputChannel(): vscode.OutputChannel { return this._outputChannel; }

  async start(): Promise<void> {
    if (this._isRunning) { return; }

    this._processExited = false;
    this._processError = '';
    this._outputBuffer = '';
    this._port = 0;
    this._webviewUrl = '';

    this._hostname = vscode.workspace.getConfiguration('opencode-sidebar-web')
      .get('hostname', '127.0.0.1');

    const pm = createPlatformManager();
    const gh = new GitHubAPI();

    const versionSetting = vscode.workspace.getConfiguration('opencode-sidebar-web')
      .get('opencodeVersion', 'latest') as string;

    const cacheDir = path.join(this._storagePath, 'opencode-bin', versionSetting);
    const binaryPath = path.join(cacheDir, pm.getBinaryName());

    if (!fs.existsSync(binaryPath) || !this.isExecutableFile(binaryPath)) {
      this._outputChannel.appendLine(`OpenCode binary not cached at ${binaryPath}, downloading...`);

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Downloading OpenCode...',
        cancellable: false,
      }, async (progress) => {
        progress.report({ message: 'Resolving version...' });

        const release = await gh.getRelease(versionSetting);
        const assetName = pm.getAssetName(release.tag_name);
        const asset = gh.getAsset(release, assetName);

        fs.mkdirSync(cacheDir, { recursive: true });

        progress.report({ message: `Downloading ${assetName}...` });

        const archiveBuffer = await gh.download(
          asset.browser_download_url,
          (downloaded, total) => {
            const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
            progress.report({ message: `Downloading... ${pct}%` });
          }
        );

        progress.report({ message: 'Extracting...' });
        await pm.extractBinary(archiveBuffer, cacheDir);
        await pm.makeExecutable(binaryPath);

        this._outputChannel.appendLine(`OpenCode binary downloaded and cached at ${binaryPath}`);
      });
    }

    if (!fs.existsSync(binaryPath) || !this.isExecutableFile(binaryPath)) {
      throw new Error(`OpenCode binary not found at ${binaryPath}`);
    }

    this._outputChannel.appendLine(`Starting OpenCode server...`);
    this._outputChannel.appendLine(`Binary: ${binaryPath}`);

    const activeUri = vscode.window.activeTextEditor?.document.uri;
    const activeWorkspace = activeUri ? vscode.workspace.getWorkspaceFolder(activeUri) : undefined;
    const workspaceFolder = vscode.workspace.workspaceFolders?.find((folder) => folder.uri.fsPath === activeWorkspace?.uri.fsPath)?.uri.fsPath
      || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      || vscode.workspace.workspaceFile?.fsPath
      || this._extensionPath;

    const args = ['serve', '--port', '0', '--hostname', this._hostname];

    this._outputChannel.appendLine(
      `Run manually to debug: ${binaryPath} ${args.join(' ')}${workspaceFolder ? ` (cwd: ${workspaceFolder})` : ''}`
    );

    this.process = spawn(binaryPath, args, {
      cwd: workspaceFolder,
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
    await this.resolveWebviewUrl();

    this._isRunning = true;
    this.updateStatusBar();
    this._onDidChangeStatus.fire(true);
    this._outputChannel.appendLine(`Server ready at ${this.serverUrl}`);
  }

  private handleOutput(text: string): void {
    this._outputChannel.append(text);
    this._outputBuffer += text;
    if (this._outputBuffer.length > 10000) {
      this._outputBuffer = this._outputBuffer.slice(-5000);
    }

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
        const response = await fetch(`${this.serverUrl}${HEALTH_ENDPOINT}`, {
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

  private async startProxy(targetUrl?: string): Promise<void> {
    const bindHost = this.isRemoteEnvironment() ? '0.0.0.0' : '127.0.0.1';
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

        const upstream = targetUrl || this.serverUrl;
        const target = `${upstream}${req.url}`;
        const proxyReq = http.request(target, {
          method: req.method,
          headers: { ...req.headers, host: `${this._hostname}:${this._port}` },
        }, (proxyRes) => {
          const headers = { ...proxyRes.headers };
          if (typeof headers.location === 'string') {
            try {
              const locationUrl = new URL(headers.location);
              const upstreamUrl = new URL(upstream);
              if (locationUrl.origin === upstreamUrl.origin) {
                const proxyOrigin = this._webviewUrl
                  ? new URL(this._webviewUrl).origin
                  : `http://${bindHost}:${this._proxyPort}`;
                headers.location = `${proxyOrigin}${locationUrl.pathname}${locationUrl.search}${locationUrl.hash}`;
              }
            } catch {
              // If parsing fails, do not rewrite location.
            }
          }
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

      this.proxy.on('upgrade', (req, socket, head) => {
        const upstream = targetUrl || this.serverUrl;
        const target = `${upstream}${req.url}`;
        const proxyReq = http.request(target, {
          method: req.method,
          headers: { ...req.headers, host: `${this._hostname}:${this._port}` },
        });

        proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
          socket.write(`HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n`);
          for (const [name, value] of Object.entries(proxyRes.headers)) {
            if (value) {
              if (Array.isArray(value)) {
                for (const v of value) {
                  socket.write(`${name}: ${v}\r\n`);
                }
              } else {
                socket.write(`${name}: ${value}\r\n`);
              }
            }
          }
          socket.write('\r\n');
          if (proxyHead?.length) {
            proxySocket.write(proxyHead);
          }
          proxySocket.pipe(socket).pipe(proxySocket);
        });

        proxyReq.on('error', () => {
          socket.end();
        });

        proxyReq.end();
      });

      this.proxy.listen(0, bindHost, () => {
        const addr = this.proxy!.address();
        if (addr && typeof addr === 'object') {
          this._proxyPort = addr.port;
        }
        this._outputChannel.appendLine(
          `Proxy listening on http://${bindHost}:${this._proxyPort}`
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
    if (!this._isRunning) { return; }

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
