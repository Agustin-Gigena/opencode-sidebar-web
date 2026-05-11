import * as vscode from 'vscode';
import { OpenCodeServer } from './OpenCodeServer';

export class OpenCodePanel {
  static readonly viewType = 'opencode-sidebar-web.panel';
  private panel: vscode.WebviewPanel | null = null;
  private _isStarting = false;
  private _errorMessage = '';
  private _serverCrashed = false;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _server: OpenCodeServer,
    private readonly _onStartServer: () => Promise<void>
  ) {}

  async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(undefined, true);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      OpenCodePanel.viewType,
      'OpenCode',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this._extensionUri],
      }
    );

    this.panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg');
    vscode.commands.executeCommand('setContext', 'opencodeSidebarPanelVisible', true);

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'startServer') {
        this._errorMessage = '';
        this._serverCrashed = false;
        this._isStarting = true;
        this.render();
        await this._onStartServer();
        this._isStarting = false;
      } else if (msg.type === 'showLogs') {
        this._server.outputChannel.show();
      } else if (msg.type === 'openSettings') {
        vscode.commands.executeCommand(
          'workbench.action.openSettings', 'opencode-sidebar-web'
        );
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = null;
      vscode.commands.executeCommand('setContext', 'opencodeSidebarPanelVisible', false);
    });

    this.render();
  }

  get isVisible(): boolean {
    return this.panel?.visible ?? false;
  }

  close(): void {
    this.panel?.dispose();
    this.panel = null;
    vscode.commands.executeCommand('setContext', 'opencodeSidebarPanelVisible', false);
  }

  setError(message: string): void {
    this._isStarting = false;
    this._errorMessage = message;
    this.render();
  }

  markCrashed(): void {
    this._isStarting = false;
    this._serverCrashed = true;
    this.render();
  }

  clearState(): void {
    this._isStarting = false;
    this._errorMessage = '';
    this._serverCrashed = false;
  }

  render(): void {
    const p = this.panel;
    if (!p) { return; }
    p.webview.html = this.getHtmlContent();
  }

  private getHtmlContent(): string {
    const proxyUrl = this._server.isRunning ? this._server.proxyUrl : '';

    let statusColor: string;
    let statusText: string;
    if (this._server.isRunning) {
      statusColor = '#4ec94e';
      statusText = `Connected \u25CF  port ${this._server.proxyPort}`;
    } else if (this._isStarting) {
      statusColor = '#e5c07b';
      statusText = 'Starting...';
    } else {
      statusColor = '#e06c75';
      statusText = 'Disconnected \u25CB';
    }

    let overlayContent: string;
    if (this._server.isRunning) {
      overlayContent = '';
    } else if (this._isStarting) {
      overlayContent =
        '<div class="spinner"></div><span>Starting OpenCode server...</span>';
    } else if (this._errorMessage) {
      overlayContent =
        `<div class="error-icon">\u26A0</div>` +
        `<span class="error-msg">Failed to start server</span>` +
        `<span class="error-detail">${this.escapeHtml(this._errorMessage)}</span>` +
        `<div class="btn-row"><button onclick="startServer()">Retry</button>` +
        `<button class="secondary" onclick="showLogs()">View Logs</button></div>`;
    } else if (this._serverCrashed) {
      overlayContent =
        `<div class="error-icon">\u26A0</div>` +
        `<span>Server disconnected unexpectedly</span>` +
        `<div class="btn-row"><button onclick="startServer()">Reconnect</button>` +
        `<button class="secondary" onclick="showLogs()">View Logs</button></div>`;
    } else {
      overlayContent =
        `<span>OpenCode server is not running</span>` +
        `<div class="btn-row"><button onclick="startServer()">Start Server</button>` +
        `<button class="secondary" onclick="showLogs()">View Logs</button></div>`;
    }

    const csp = [
      "default-src 'self' http://127.0.0.1:* http://localhost:*;",
      "frame-src http://127.0.0.1:* http://localhost:*;",
      "style-src 'self' 'unsafe-inline';",
      "script-src 'self' 'unsafe-inline';",
      "img-src 'self' http://127.0.0.1:* http://localhost:* https: data:;",
      "connect-src 'self' http://127.0.0.1:* http://localhost:* https: data:;",
      "font-src 'self' http://127.0.0.1:* data:;",
    ].join(' ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>OpenCode</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { height:100%; width:100%; overflow:hidden; background:var(--vscode-sideBar-background,#1e1e1e); }
    iframe { width:100%; height:calc(100% - 24px); border:none; }
    .status-bar {
      height:24px; display:flex; align-items:center; padding:0 10px;
      font-family:var(--vscode-font-family,sans-serif); font-size:11px;
      background:var(--vscode-statusBar-background,#007acc);
      color:var(--vscode-statusBar-foreground,#fff);
      gap:6px; user-select:none;
    }
    .status-bar .dot {
      display:inline-block; width:8px; height:8px; border-radius:50%;
      background:${statusColor}; flex-shrink:0;
    }
    .status-bar .spacer { flex:1; }
    .status-bar a {
      color:inherit; opacity:.7; text-decoration:none; cursor:pointer;
    }
    .status-bar a:hover { opacity:1; text-decoration:underline; }
    .overlay {
      position:absolute; inset:24px 0 0 0; display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:10px;
      color:var(--vscode-descriptionForeground,#999);
      font-family:var(--vscode-font-family,sans-serif); font-size:13px;
      padding:20px;
    }
    .overlay.hidden { display:none; }
    .overlay .error-icon { font-size:24px; }
    .overlay .error-msg { color:var(--vscode-errorForeground,#e06c75); font-weight:600; }
    .overlay .error-detail { font-size:12px; opacity:.8; text-align:center; max-width:400px; word-break:break-word; }
    .overlay .btn-row { display:flex; gap:8px; margin-top:4px; }
    .overlay button {
      padding:8px 16px; border:none; cursor:pointer; border-radius:2px;
      background:var(--vscode-button-background,#007acc);
      color:var(--vscode-button-foreground,#fff);
      font-family:var(--vscode-font-family,sans-serif);
    }
    .overlay button.secondary {
      background:var(--vscode-button-secondaryBackground,#3a3d41);
      color:var(--vscode-button-secondaryForeground,#fff);
    }
    .overlay .spinner {
      width:32px; height:32px;
      border:3px solid var(--vscode-editorWidget-border,#454545);
      border-top-color:var(--vscode-focusBorder,#007acc);
      border-radius:50%; animation:spin .8s linear infinite;
    }
    @keyframes spin { to { transform:rotate(360deg); } }
  </style>
</head>
<body>
  <div class="status-bar">
    <span class="dot"></span>
    <span>${statusText}</span>
    <span class="spacer"></span>
    <a onclick="showLogs()">Logs</a>
    <a onclick="openSettings()" style="margin-left:8px">Settings</a>
  </div>

  <iframe id="ocFrame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    ${proxyUrl ? `src="${proxyUrl}"` : ''}></iframe>

  <div id="overlay" class="overlay ${proxyUrl ? 'hidden' : ''}">
    ${proxyUrl ? '' : overlayContent}
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function startServer() {
      vscode.postMessage({ type: 'startServer' });
    }

    function showLogs() {
      vscode.postMessage({ type: 'showLogs' });
    }

    function openSettings() {
      vscode.postMessage({ type: 'openSettings' });
    }

    function syncTheme() {
      const classes = document.body.className;
      const theme = classes.includes('vscode-dark') ? 'dark'
        : classes.includes('vscode-high-contrast') ? 'high-contrast'
        : 'light';
      const iframe = document.getElementById('ocFrame');
      if (iframe && iframe.contentWindow) {
        const origin = iframe.src ? new URL(iframe.src).origin : '*';
        iframe.contentWindow.postMessage(
          { type: 'opencodeTheme', theme, source: 'vscode' }, origin
        );
      }
    }

    syncTheme();
    const obs = new MutationObserver(syncTheme);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
