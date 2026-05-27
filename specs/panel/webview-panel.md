# Webview Panel

**File**: `src/OpenCodePanel.ts`

## Registration

- Registered as a `WebviewViewProvider` with ID `opencode-sidebar-web.view`.
- Contributes to the secondary sidebar via `contributes.views` in `package.json`.
- View container: `opencode-sidebar-web` in the secondary sidebar.

## Lifecycle

1. **Resolution** (`resolveWebviewView`): Called by VS Code when the panel becomes visible.
   - Stores the `WebviewView` instance.
   - Sets `enableScripts: true` for JavaScript execution.
   - Configures `localResourceRoots` for the extension URI.
   - Sets up `onDidReceiveMessage` handler for messages from webview JS.
   - Tracks visibility changes via `onDidChangeVisibility`.
   - Calls `render()`.

2. **Visibility**: Tracked via `_panelVisible` boolean and VS Code context `opencodeSidebarPanelVisible`.

3. **Show**: Calls `workbench.view.extension.opencode-sidebar-web` to reveal the view.

4. **Close**: Hides the secondary sidebar via `workbench.action.agentToggleSecondarySidebarVisibility` (with fallback to `workbench.action.toggleSecondarySidebarVisibility`).

## Message Protocol (Webview → Extension)

| Message Type | Handler | Action |
|---|---|---|
| `closePanel` | `openPanel` command | Toggles panel closed |
| `startServer` | `_onStartServer` callback | Clears error, triggers server start |
| `showLogs` | N/A | Shows `_server.outputChannel` |
| `openSettings` | N/A | Opens VS Code settings filtered to `opencode-sidebar-web` |

## HTML Structure

### Status Bar (24px height)

- Colored dot indicator:
  - Green (`#4ec94e`): Connected
  - Yellow (`#e5c07b`): Starting
  - Red (`#e06c75`): Disconnected
- Status text with port number (or "(existing)" for detected servers).
- Action links: Logs, Settings, Close.

### Content Area

- **Iframe** (when server is running): Shows the OpenCode web UI via `webviewUrl`. Sandbox attributes: `allow-scripts allow-same-origin allow-forms allow-popups`.
- **Overlay** (when server is not running): One of four states:
  - *Connecting*: Spinner animation + "Starting OpenCode server..."
  - *Error*: Warning icon + error message + "Retry" / "View Logs" buttons.
  - *Crashed*: Warning icon + "Server disconnected unexpectedly" + "Reconnect" / "View Logs" buttons.
  - *Idle*: "OpenCode server is not running" + "Start Server" / "View Logs" buttons.

### Inline JavaScript

- `acquireVsCodeApi()` for VS Code API access.
- Functions: `startServer()`, `showLogs()`, `openSettings()`, `closePanel()`, `syncTheme()`.
- `syncTheme()`: Observes `document.body.className` mutations and posts `{ type: 'opencodeTheme', theme, source: 'vscode' }` to the iframe. Supports `dark`, `light`, and `high-contrast` themes.

## Content Security Policy

The CSP is dynamically generated based on the server URL:

```
default-src 'self' http://127.0.0.1:* http://localhost:*;
frame-src http://127.0.0.1:* http://localhost:* <webview-origin>;
style-src 'self' 'unsafe-inline';
script-src 'self' 'unsafe-inline';
img-src 'self' http://127.0.0.1:* http://localhost:* <webview-origin> https: data:;
connect-src 'self' http://127.0.0.1:* http://localhost:* <webview-origin> https: data:;
font-src 'self' http://127.0.0.1:* data:;
```

## HTTP Proxy

**Purpose**: Strip frame-blocking headers (`X-Frame-Options`, `Content-Security-Policy`, `Content-Security-Policy-Report-Only`) from upstream responses so the OpenCode UI can be embedded in an iframe.

**Behavior**:
- Listens on `127.0.0.1` on a random port (OS-assigned).
- Forwards all HTTP requests to the OpenCode server.
- Strips frame-blocking headers from responses.
- Adds `Access-Control-Allow-Origin: *` and `access-control-expose-headers: *`.
- Handles CORS preflight (`OPTIONS`) requests.
- Returns 502 Bad Gateway on upstream errors.

## Remote URL Resolution

In remote/devcontainer environments:
- `vscode.env.asExternalUri` converts local proxy URLs to externally-accessible URIs.
- The resolved URL is used as the iframe `src`.

## State Management

| State | Triggered by | UI Effect |
|---|---|---|
| `_isStarting` | `startServer` message | Spinner overlay, yellow status |
| `_errorMessage` | `setError()` from start failure | Error overlay with message |
| `_serverCrashed` | `markCrashed()` from server status change | Crash overlay |
| `clearState()` | Server start, stop, restart commands | Resets all state flags |

## Theming

- Uses VS Code CSS variables: `--vscode-sideBar-background`, `--vscode-statusBar-background`, `--vscode-statusBar-foreground`, `--vscode-button-background`, `--vscode-errorForeground`, etc.
- Theme synced to iframe via `postMessage` on every body class change.

## Related Specs

- [../operations/extension-lifecycle.md](../operations/extension-lifecycle.md)
- [../server/server-management.md](../server/server-management.md)
- [../server/remote-environments.md](../server/remote-environments.md)
