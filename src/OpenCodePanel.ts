import * as vscode from 'vscode';
import { OpenCodeServer } from './OpenCodeServer';

export class OpenCodePanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'opencode-sidebar-web.view';
  private _view: vscode.WebviewView | undefined;
  private _panelVisible = false;
  private _isStarting = false;
  private _errorMessage = '';
  private _serverCrashed = false;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _server: OpenCodeServer,
    private readonly _onStartServer: () => Promise<void>
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    this._panelVisible = true;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'closePanel') {
        vscode.commands.executeCommand('opencode-sidebar-web.openPanel');
      } else if (msg.type === 'startServer') {
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

    webviewView.onDidDispose(() => {
      this._view = undefined;
      this._panelVisible = false;
      vscode.commands.executeCommand('setContext', 'opencodeSidebarPanelVisible', false);
    });

    webviewView.onDidChangeVisibility(() => {
      this._panelVisible = webviewView.visible;
      vscode.commands.executeCommand('setContext', 'opencodeSidebarPanelVisible', webviewView.visible);
    });

    vscode.commands.executeCommand('setContext', 'opencodeSidebarPanelVisible', true);

    this.render();
  }

  get isVisible(): boolean {
    return this._panelVisible;
  }

  async show(): Promise<void> {
    if (this._panelVisible) {
      return;
    }
    await vscode.commands.executeCommand('workbench.view.extension.opencode-sidebar-web');
  }

  async close(): Promise<void> {
    this._panelVisible = false;
    this._view = undefined;
    vscode.commands.executeCommand('setContext', 'opencodeSidebarPanelVisible', false);
    try {
      await vscode.commands.executeCommand('workbench.action.agentToggleSecondarySidebarVisibility');
    } catch {
      await vscode.commands.executeCommand('workbench.action.toggleSecondarySidebarVisibility');
    }
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

  postMessage(message: any): void {
    this._view?.webview.postMessage(message);
  }

  clearState(): void {
    this._isStarting = false;
    this._errorMessage = '';
    this._serverCrashed = false;
  }

  render(): void {
    const view = this._view;
    if (!view) { return; }
    view.webview.html = this.getHtmlContent();
  }

  private getHtmlContent(): string {
    const webviewUrl = this._server.isRunning ? this._server.webviewUrl : '';

    let statusColor: string;
    let statusText: string;
    let portLabel = '';
    if (this._server.isRunning) {
      statusColor = '#4ec94e';
      if (this._server.isConnectedToExisting) {
        portLabel = ' (existing)';
      }
      const displayPort = this._server.proxyPort || this._server.port;
      statusText = `Connected \u25CF  port ${displayPort}${portLabel}`;
    } else if (this._isStarting) {
      statusColor = '#e5c07b';
      statusText = 'Starting...';
    } else {
      statusColor = '#e06c75';
      statusText = 'Disconnected \u25CB';
    }

    let overlayContent: string;
    const hasWebviewUrl = Boolean(webviewUrl);
    if (this._server.isRunning && hasWebviewUrl) {
      overlayContent = '';
    } else if (this._server.isRunning && !hasWebviewUrl) {
      overlayContent =
        `<div class="error-icon">\u26A0</div>` +
        `<span class="error-msg">Server started but no webview URL is available</span>` +
        `<span class="error-detail">Check the extension output logs for remote URL resolution errors.</span>` +
        `<div class="btn-row"><button class="secondary" onclick="showLogs()">View Logs</button></div>`;
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

    const webviewOrigin = webviewUrl
      ? (() => { try { return new URL(webviewUrl).origin; } catch { return ''; } })()
      : '';
    const baseCsp = "default-src 'self' http://127.0.0.1:* http://localhost:* https:;";
    const frameSrc = webviewOrigin
      ? `frame-src http://127.0.0.1:* http://localhost:* ${webviewOrigin};`
      : "frame-src http://127.0.0.1:* http://localhost:*;";
    const csp = [
      baseCsp,
      frameSrc,
      "style-src 'self' 'unsafe-inline';",
      "script-src 'self' 'unsafe-inline';",
      `img-src 'self' http://127.0.0.1:* http://localhost:* ${webviewOrigin || 'https:'} data:;`,
      `connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* ${webviewOrigin || 'https:'} data:;`,
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
    <a onclick="closePanel()" style="margin-left:8px">Close</a>
  </div>

  <iframe id="ocFrame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    ${webviewUrl ? `src="${webviewUrl}"` : ''} title="OpenCode"></iframe>

  <div id="overlay" class="overlay ${hasWebviewUrl ? 'hidden' : ''}">
    ${webviewUrl ? '' : overlayContent}
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

    function closePanel() {
      vscode.postMessage({ type: 'closePanel' });
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

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'addToChatInput') {
        const iframe = document.getElementById('ocFrame');
        if (iframe && iframe.contentWindow) {
          const origin = iframe.src ? new URL(iframe.src).origin : '*';
          iframe.contentWindow.postMessage(
            { type: 'addToChatInput', filePath: msg.filePath, lines: msg.lines },
            origin
          );
        }
      }
    });

    syncTheme();
    let frameLoaded = false;
    const frame = document.getElementById('ocFrame');
    const overlay = document.getElementById('overlay');

    function showLoadError() {
      if (frameLoaded) { return; }
      overlay.classList.remove('hidden');
      overlay.innerHTML =
        '<div class="error-icon">⚠</div>' +
        '<span class="error-msg">OpenCode failed to load</span>' +
        '<span class="error-detail">The server is running, but the iframe could not be displayed. Check the logs for connection issues.</span>' +
        '<div class="btn-row"><button class="secondary" onclick="showLogs()">View Logs</button></div>';
    }

    if (frame) {
      frame.addEventListener('load', () => {
        frameLoaded = true;
        if (overlay) {
          overlay.classList.add('hidden');
        }
      });
      frame.addEventListener('error', () => showLoadError());
    }

    setTimeout(() => showLoadError(), 8000);
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
