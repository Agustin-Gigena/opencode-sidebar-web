import * as vscode from 'vscode';
import * as http from 'http';

const CSP_HEADERS = [
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
];

const PORT_REGEX = /listening on https?:\/\/[^:]+:(\d+)/i;
const HEALTH_ENDPOINT = '/global/health';

let OpencodeSDK: any = null;

async function getSDK() {
  if (!OpencodeSDK) {
    OpencodeSDK = await import('@opencode-ai/sdk');
  }
  return OpencodeSDK;
}

export class OpenCodeServer {
  private process: { url: string; close(): void } | null = null;
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
  private _client: any = null;

  constructor(context: vscode.ExtensionContext) {
    this._extensionPath = context.extensionPath;
    this._storagePath = context.globalStorageUri?.fsPath
      || context.storageUri?.fsPath
      || context.extensionPath;
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
  get serverUrl(): string { return this.process?.url || `http://${this._hostname}:${this._port}`; }
  get proxyUrl(): string { return `http://${this._hostname}:${this._proxyPort}`; }
  get webviewUrl(): string { return this._webviewUrl || this.proxyUrl; }
  get lastError(): string { return this._processError; }
  get lastExitCode(): number | null { return this._processExitCode; }
  get outputChannel(): vscode.OutputChannel { return this._outputChannel; }
  get client(): any { return this._client; }

  async start(): Promise<void> {
    if (this._isRunning) { return; }

    this._processExited = false;
    this._processError = '';
    this._outputBuffer = '';
    this._port = 0;
    this._webviewUrl = '';

    this._hostname = vscode.workspace.getConfiguration('opencode-sidebar-web')
      .get('hostname', '127.0.0.1');

    // Wait for workspace folder to be available
    let workspaceFolder: string | undefined;
    for (let i = 0; i < 10; i++) {
      const activeUri = vscode.window.activeTextEditor?.document.uri;
      const activeWorkspace = activeUri ? vscode.workspace.getWorkspaceFolder(activeUri) : undefined;
      workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        || activeWorkspace?.uri.fsPath
        || vscode.workspace.workspaceFile?.fsPath
        || this._extensionPath;
      if (workspaceFolder) break;
      await this.sleep(100);
    }
    workspaceFolder ||= this._extensionPath;

    this._outputChannel.appendLine(`Starting OpenCode server...`);
    this._outputChannel.appendLine(`Workspace folder: ${workspaceFolder}`);

    try {
      const sdk = await getSDK();
      const { client, server } = await sdk.createOpencode({
        hostname: this._hostname,
        port: 0,
      });

      this._client = client;
      this.process = server;

      // Extract port from server URL
      const url = new URL(server.url);
      this._port = parseInt(url.port, 10);
      this._outputChannel.appendLine(`OpenCode server started at ${server.url}`);

      // Start proxy
      await this.startProxy(server.url);
      await this.resolveWebviewUrl();

      this._isRunning = true;
      this.updateStatusBar();
      this._onDidChangeStatus.fire(true);
      this._outputChannel.appendLine(`Server ready at ${this.serverUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._processError = message;
      this._outputChannel.appendLine(`Failed to start OpenCode server: ${message}`);
      throw err;
    }
  }

  private async resolveWebviewUrl(): Promise<void> {
    if (vscode.env.remoteName !== undefined && this._proxyPort > 0) {
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

  private async startProxy(targetUrl?: string): Promise<void> {
    const bindHost = vscode.env.remoteName !== undefined ? '0.0.0.0' : '127.0.0.1';
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
      if (this._client) {
        // The SDK handles session cleanup
      }
    } catch { /* ignore */ }

    if (this.process) {
      this.process.close();
      this.process = null;
    }

    this.stopProxy();

    await this.sleep(500);
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

  private cleanup(): void {
    this._isRunning = false;
    this._client = null;
    this.stopProxy();
    this.updateStatusBar();
    this._onDidChangeStatus.fire(false);
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