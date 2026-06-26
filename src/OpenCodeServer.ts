import * as vscode from 'vscode';
import { ChildProcess, exec, execFile, execSync, spawn } from 'child_process';
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
const OPENCODE_PACKAGE = 'opencode-ai';
const OPENCODE_DEFAULT_PORT = 4096;
const HEALTH_ENDPOINT = '/global/health';

interface DetectedServer {
  url: string;
  password?: string;
}

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
  private _existingServerUrl: string | null = null;
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

  isBinaryInstalled(): boolean {
    return this.findBinaryPath() !== undefined;
  }

  private _installTerminal: vscode.Terminal | null = null;

  private getNodeCompatibilityMessage(): string | undefined {
    const major = parseInt(process.versions.node.split('.')[0], 10);
    if (major < 18) {
      return `OpenCode installation requires Node.js 18+ (recommended 22). Current runtime is ${process.version}.`;
    }
    return undefined;
  }

  private getPackageManagerInvocation(): { command: string; args: string[] } {
    const installArgs = ['install', `${OPENCODE_PACKAGE}@latest`, '--no-audit', '--no-fund'];
    const npmExecPath = process.env.npm_execpath;
    if (npmExecPath) {
      return {
        command: process.execPath,
        args: [npmExecPath, ...installArgs],
      };
    }

    return {
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: installArgs,
    };
  }

  async installBinary(): Promise<void> {
    if (this._installTerminal) {
      this._installTerminal.dispose();
      this._installTerminal = null;
    }

    const writeEmitter = new vscode.EventEmitter<string>();
    let npmProcess: ChildProcess | null = null;

    const pty: vscode.Pseudoterminal = {
      onDidWrite: writeEmitter.event,
      open: () => {
        writeEmitter.fire('Installing opencode-ai...\r\n\r\n');
      },
      close: () => {
        if (npmProcess && npmProcess.exitCode === null) {
          npmProcess.kill('SIGTERM');
        }
      }
    };

    this._installTerminal = vscode.window.createTerminal({
      name: 'OpenCode Install',
      pty,
    });
    this._installTerminal.show();

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Installing OpenCode...',
      cancellable: false,
    }, async (progress) => {
      return new Promise<void>((resolve, reject) => {
        let completed = false;
        let timer: NodeJS.Timeout | undefined;

        const compatibilityMessage = this.getNodeCompatibilityMessage();
        if (compatibilityMessage) {
          completed = true;
          if (timer) {
            clearInterval(timer);
          }
          reject(new Error(compatibilityMessage));
          return;
        }

        const { command, args } = this.getPackageManagerInvocation();
        this._outputChannel.appendLine(`Running install command: ${command} ${args.join(' ')}`);

        const nodeExecutable = process.execPath;
        const nodeVersion = process.versions.node;
        this._outputChannel.appendLine(`Using Node ${nodeVersion} from ${nodeExecutable}`);

        npmProcess = execFile(command, args, {
          cwd: this._extensionPath,
          windowsHide: true,
          env: process.env,
        });

        const startTime = Date.now();
        const ESTIMATED_DURATION = 30000;
        let lineCount = 0;

        const barWidth = 30;
        const renderBar = (pct: number) => {
          const filled = Math.round((pct / 100) * barWidth);
          return `${Math.round(pct)}% [${'#'.repeat(filled)}${' '.repeat(barWidth - filled)}]`;
        };

        const updateProgress = () => {
          if (completed) { return; }
          const elapsed = Date.now() - startTime;
          const timePct = Math.min(elapsed / ESTIMATED_DURATION * 100, 90);
          const linePct = Math.min(lineCount / 25 * 100, 90);
          const pct = Math.max(timePct, linePct);
          const bar = renderBar(pct);
          progress.report({ message: bar });
          writeEmitter.fire(`\r${bar}`);
        };

        timer = setInterval(updateProgress, 200);

        npmProcess.stdout?.on('data', (data: Buffer) => {
          writeEmitter.fire(data.toString());
        });

        npmProcess.stderr?.on('data', (data: Buffer) => {
          const text = data.toString();
          writeEmitter.fire(text);
          lineCount += (text.match(/\n/g) || []).length;
          updateProgress();
        });

        npmProcess.on('exit', (code) => {
          completed = true;
          clearInterval(timer);
          if (code === 0) {
            const bar = renderBar(100);
            progress.report({ message: bar });
            writeEmitter.fire(`\r${bar}\r\n\r\n`);
            writeEmitter.fire('Installation complete!\r\n');
            resolve();
          } else {
            reject(new Error(`npm install exited with code ${code}. Check terminal for details.`));
          }
        });

        npmProcess.on('error', (err) => {
          completed = true;
          clearInterval(timer);
          const processError = err as NodeJS.ErrnoException;
          const message = processError.code === 'ENOENT'
            ? `npm install failed: ${processError.message}. Please ensure npm is installed and available in PATH.`
            : `npm install failed: ${processError.message}`;
          this._outputChannel.appendLine(`Install process error: ${message}`);
          reject(new Error(message));
        });
      });
    });
  }

  isRemoteEnvironment(): boolean {
    return vscode.env.remoteName !== undefined;
  }

  async detectExistingServer(): Promise<DetectedServer | null> {
    const envPassword = process.env.OPENCODE_SERVER_PASSWORD;
    const results: Array<{ url: string; password?: string }> = [];

    // 1. Check env vars
    const envUrl = process.env.OPENCODE_URL;
    const envPort = process.env.OPENCODE_PORT;
    if (envUrl) {
      results.push({ url: envUrl, password: envPassword || undefined });
    }
    if (envPort) {
      results.push({ url: `http://127.0.0.1:${envPort}`, password: envPassword || undefined });
    }

    // 2. Try pgrep to find running opencode process
    try {
      const pgrepOut = execSync('pgrep -x opencode', { encoding: 'utf8', timeout: 5000 });
      const pids = pgrepOut.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
          const args = cmdline.split('\0');
          let port = OPENCODE_DEFAULT_PORT;
          let hostname = '127.0.0.1';
          for (let i = 0; i < args.length; i++) {
            if (args[i] === '--port' && i + 1 < args.length) {port = parseInt(args[i + 1], 10);}
            if (args[i] === '--hostname' && i + 1 < args.length) {hostname = args[i + 1];}
          }
          if (port !== 0) {
            results.push({ url: `http://${hostname}:${port}`, password: envPassword || undefined });
          }
        } catch { /* skip unreadable process */ }
      }
    } catch { /* pgrep not available or no process */ }

    // 3. Only try the default port if there is a real local binary and the port is likely to be serving.
    const packagedBinary = this.findPackagedBinaryPath();
    if (packagedBinary) {
      results.push({ url: `http://127.0.0.1:${OPENCODE_DEFAULT_PORT}`, password: envPassword || undefined });
    }

    // Health check each candidate, return first that responds
    for (const candidate of results) {
      try {
        const headers: Record<string, string> = {};
        if (candidate.password) {
          headers['Authorization'] = `Basic ${Buffer.from(
            `opencode:${candidate.password}`
          ).toString('base64')}`;
        }
        const resp = await fetch(`${candidate.url}${HEALTH_ENDPOINT}`, {
          signal: AbortSignal.timeout(2000),
          headers: Object.keys(headers).length ? headers : undefined,
        });
        if (resp.ok) {
          this._outputChannel.appendLine(`Detected existing server at ${candidate.url}`);
          return candidate;
        }
      } catch { /* try next */ }
    }

    return null;
  }

  async connectToExisting(detected: DetectedServer): Promise<void> {
    this._existingServerUrl = detected.url;
    this._outputChannel.appendLine(`Connecting to existing OpenCode server at ${detected.url}`);

    const parsedUrl = new URL(detected.url);
    this._hostname = parsedUrl.hostname;
    this._port = parseInt(parsedUrl.port, 10);
    this.process = null;
    this._processExited = false;
    this._processError = '';

    const needsProxy = this.isRemoteEnvironment() || await this.checkNeedsProxy(detected);
    if (needsProxy) {
      this._outputChannel.appendLine('Using proxy for existing server connection...');
      await this.startProxy();
      await this.resolveWebviewUrl();
    } else {
      const localUri = vscode.Uri.parse(detected.url);
      if (this.isRemoteEnvironment()) {
        try {
          const external = await vscode.env.asExternalUri(localUri);
          this._webviewUrl = external.toString();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this._outputChannel.appendLine(
            `asExternalUri failed on detected server URL: ${message}. Falling back to proxy.`
          );
          await this.startProxy();
          await this.resolveWebviewUrl();
        }
      } else {
        this._webviewUrl = detected.url;
      }
    }

    this._isRunning = true;
    this.updateStatusBar();
    this._onDidChangeStatus.fire(true);
    this._outputChannel.appendLine(`Connected to existing server at ${detected.url}`);
  }

  private async checkNeedsProxy(detected: DetectedServer): Promise<boolean> {
    const urls = [
      `${detected.url}${HEALTH_ENDPOINT}`,
      detected.url.endsWith('/') ? detected.url : `${detected.url}/`,
    ];

    for (const url of urls) {
      try {
        const headers: Record<string, string> = {};
        if (detected.password) {
          headers['Authorization'] = `Basic ${Buffer.from(
            `opencode:${detected.password}`
          ).toString('base64')}`;
        }
        const resp = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
          headers: Object.keys(headers).length ? headers : undefined,
        });

        const xfo = resp.headers.get('x-frame-options');
        if (xfo) {
          this._outputChannel.appendLine(`Detected X-Frame-Options on ${url}: ${xfo}`);
          return true;
        }

        const csp = resp.headers.get('content-security-policy');
        if (csp && csp.toLowerCase().includes('frame-ancestors')) {
          this._outputChannel.appendLine(`Detected CSP frame-ancestors on ${url}`);
          return true;
        }

        return false;
      } catch (err) {
        this._outputChannel.appendLine(`Could not inspect headers on ${url}: ${(err as Error).message}`);
      }
    }

    return true;
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

  private findPackagedBinaryPath(): string | undefined {
    const binaryName = platform() === 'win32' ? 'opencode.exe' : 'opencode';
    const extModules = path.join(this._extensionPath, 'node_modules');
    const candidates = [
      path.join(extModules, 'opencode-ai', 'bin', binaryName),
      path.join(extModules, 'opencode-ai', 'bin', '.opencode'),
      path.join(extModules, '.bin', 'opencode'),
      path.join(extModules, '.bin', 'opencode.cmd'),
      path.join(extModules, 'opencode-ai', 'bin', 'opencode'),
    ];

    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) {
          return c;
        }
      } catch { /* next */ }
    }

    return undefined;
  }

  private isExecutableFile(filePath: string): boolean {
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  private ensureBundledBinary(): string | undefined {
    const binaryName = platform() === 'win32' ? 'opencode.exe' : 'opencode';
    const targetDir = path.join(this._storagePath, 'bin');
    const targetPath = path.join(targetDir, binaryName);

    if (fs.existsSync(targetPath) && this.isExecutableFile(targetPath)) {
      return targetPath;
    }

    const extModules = path.join(this._extensionPath, 'node_modules');
    const sourceCandidates = [
      path.join(extModules, 'opencode-ai', 'bin', binaryName),
      path.join(extModules, 'opencode-ai', 'bin', '.opencode'),
      path.join(extModules, 'opencode-ai', 'bin', 'opencode'),
      path.join(extModules, '.bin', 'opencode'),
      path.join(extModules, '.bin', 'opencode.cmd'),
    ];

    for (const sourcePath of sourceCandidates) {
      try {
        if (!fs.existsSync(sourcePath)) {
          continue;
        }
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
        if (platform() !== 'win32' && !targetPath.endsWith('.exe')) {
          fs.chmodSync(targetPath, 0o755);
        }
        if (fs.existsSync(targetPath) && this.isExecutableFile(targetPath)) {
          return targetPath;
        }
      } catch {
        // try the next candidate
      }
    }

    return undefined;
  }

  private findBinaryPath(): string | undefined {
    const bundledBinary = this.ensureBundledBinary();
    if (bundledBinary) {
      return bundledBinary;
    }

    const binaryName = platform() === 'win32' ? 'opencode.exe' : 'opencode';

    try {
      const which = execSync(
        platform() === 'win32' ? `where ${binaryName}` : `which ${binaryName}`,
        { encoding: 'utf8', timeout: 3000 }
      );
      const found = which.split('\n')[0].trim();
      if (found) { return found; }
    } catch { /* not in PATH */ }

    const extModules = path.join(this._extensionPath, 'node_modules');

    const hidden = path.join(extModules, 'opencode-ai', 'bin', '.opencode');
    try { fs.accessSync(hidden, fs.constants.X_OK); return hidden; } catch { /* next */ }

    const plat = platform() === 'win32' ? 'windows' : platform() === 'darwin' ? 'darwin' : 'linux';
    const archName = arch();
    const candidates = [
      path.join(extModules, `opencode-${plat}-${archName}`, 'bin', binaryName),
      path.join(extModules, `opencode-${plat}-${archName}-baseline`, 'bin', binaryName),
      path.join(extModules, `opencode-${plat}-${archName}-musl`, 'bin', binaryName),
      path.join(extModules, `opencode-${plat}-${archName}-baseline-musl`, 'bin', binaryName),
    ];

    for (const c of candidates) {
      try { fs.accessSync(c, fs.constants.X_OK); return c; } catch { /* next */ }
    }

    const wrapper = path.join(extModules, '.bin', 'opencode');
    if (fs.existsSync(wrapper)) { return wrapper; }
    const winWrapper = wrapper + '.cmd';
    if (fs.existsSync(winWrapper)) { return winWrapper; }

    const aiWrapper = path.join(extModules, 'opencode-ai', 'bin', 'opencode');
    if (fs.existsSync(aiWrapper)) { return aiWrapper; }

    return undefined;
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
  get isConnectedToExisting(): boolean { return this._existingServerUrl !== null; }
  get installTerminal(): vscode.Terminal | null { return this._installTerminal; }

  async start(): Promise<void> {
    if (this._isRunning) { return; }

    this._processExited = false;
    this._processError = '';
    this._outputBuffer = '';
    this._port = 0;
    this._existingServerUrl = null;
    this._webviewUrl = '';

    this._hostname = vscode.workspace.getConfiguration('opencode-sidebar-web')
      .get('hostname', '127.0.0.1');

    const devcontainerMode = vscode.workspace.getConfiguration('opencode-sidebar-web')
      .get('devcontainerMode', true);

    if (this.isRemoteEnvironment() && devcontainerMode) {
      const existing = await this.detectExistingServer();
      if (existing) {
        await this.connectToExisting(existing);
        return;
      }
      this._outputChannel.appendLine(
        'No existing OpenCode server detected, will start a new one...'
      );
    }

    let binary = this.findBinaryPath();
    if (!binary) {
      this._outputChannel.appendLine('No bundled binary was found; attempting to prepare it from the extension package...');
      binary = this.ensureBundledBinary();
    }

    if (!binary) {
      if (this.isRemoteEnvironment()) {
        this._outputChannel.appendLine('OpenCode binary not found. Installing...');
        await this.installBinary();
        binary = this.findBinaryPath();
      }
      if (!binary) {
        throw new Error(
          `OpenCode binary could not be prepared for this environment. Run "npm install ${OPENCODE_PACKAGE}" in the extension directory, or use the "Install OpenCode" command.`
        );
      }
    }

    this._outputChannel.appendLine(`Starting OpenCode server...`);
    this._outputChannel.appendLine(`Binary: ${binary}`);

    const activeUri = vscode.window.activeTextEditor?.document.uri;
    const activeWorkspace = activeUri ? vscode.workspace.getWorkspaceFolder(activeUri) : undefined;
    const workspaceFolder = vscode.workspace.workspaceFolders?.find((folder) => folder.uri.fsPath === activeWorkspace?.uri.fsPath)?.uri.fsPath
      || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      || vscode.workspace.workspaceFile?.fsPath
      || this._extensionPath;

    const args = ['serve', '--port', '0', '--hostname', this._hostname];

    this._outputChannel.appendLine(
      `Run manually to debug: ${binary} ${args.join(' ')}${workspaceFolder ? ` (cwd: ${workspaceFolder})` : ''}`
    );

    this.process = spawn(binary, args, {
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

    if (this._existingServerUrl) {
      this._outputChannel.appendLine('Disconnecting from existing server...');
      this.stopProxy();
      this._existingServerUrl = null;
      this._webviewUrl = '';
      this.cleanup();
      this._outputChannel.appendLine('Disconnected from existing server');
      return;
    }

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
