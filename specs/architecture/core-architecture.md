# Core Architecture

## Module Layout

```
src/
  extension.ts          — Entry point: activation, commands, event handlers, reconnect
  OpenCodeServer.ts     — Server lifecycle, binary detection, proxy, remote detection
  OpenCodePanel.ts      — WebviewViewProvider: rendering, CSP, theming, error states
  test/
    extension.test.ts   — Integration tests for commands, server, detection
    test-utils.ts       — Mock helpers (ExtensionContext, HTTP server, env vars)
```

## Component Diagram

```
+------------------+       registers       +------------------+
|   extension.ts   | ──────────────────▶   |  OpenCodePanel   |
| (activation,     |                       | (WebviewViewProv.)|
|  commands,       |                       +------------------+
|  reconnect)      |                              │
+--------+---------+                              │ render()
         │                                        ▼
         │ owns                          +------------------+
         ▼                              |   HTML/CSS/JS    |
+------------------+                    | iframe + overlay |
|  OpenCodeServer  |                    | status bar       |
|                  |                    +------------------+
| - process mgmt   │
| - proxy server   │         HTTP (via proxy)
| - binary detect  │◄─────────────────────── OpenCode Web UI
| - health checks  │                        (in iframe)
| - env detection  │
+------------------+
```

## Data Flow

1. **Activation**: VS Code activates the extension → `activate()` instantiates `OpenCodeServer` and `OpenCodePanel`, registers commands and webview provider.
2. **Visibility**: When the panel becomes visible (`resolveWebviewView`), `OpenCodePanel` renders HTML with an iframe and overlay.
3. **Server start**: User clicks "Start Server" in the overlay → message posted to extension → `startServer()` → `OpenCodeServer.start()` spawns `opencode serve --port 0` → waits for health endpoint → starts an HTTP proxy to strip frame-blocking headers.
4. **Proxy**: The proxy listens on a random local port, forwards requests to the OpenCode server, strips `X-Frame-Options` and `Content-Security-Policy` headers, adds CORS.
5. **Webview rendering**: Once the server is running, the iframe `src` is set to the proxy URL (or resolved external URI in remote environments). The overlay is hidden.
6. **Status updates**: `OpenCodeServer` emits `onDidChangeStatus` events → `extension.ts` updates VS Code context variables and triggers `OpenCodePanel.render()`.
7. **Reconnection**: If the server crashes after ever having been running, `attemptReconnect()` runs an exponential backoff loop (2^N seconds, max `maxReconnectAttempts`).
8. **Deactivation**: `deactivate()` stops the server and disposes resources.

## Key Design Decisions

- **Proxy pattern**: An HTTP proxy is always started (even locally) to strip frame-blocking headers that would prevent the iframe from loading. The proxy also handles CORS.
- **Port 0 allocation**: The OpenCode server is started with `--port 0` to let the OS assign a random available port, avoiding conflicts.
- **Dual channel output**: Server stdout/stderr goes to both a VS Code `OutputChannel` and an in-memory buffer (last 10KB, truncated to 5KB) for error reporting.
- **Same-process architecture**: No separate extension host or worker; everything runs in the extension's activation context.

## Related Specs

- [operations/extension-lifecycle.md](../operations/extension-lifecycle.md) — detailed activation, commands, reconnect
- [server/server-management.md](../server/server-management.md) — binary detection, start/stop/install
- [server/server-detection.md](../server/server-detection.md) — existing server detection
- [panel/webview-panel.md](../panel/webview-panel.md) — webview rendering and proxy
- [server/remote-environments.md](../server/remote-environments.md) — remote/devcontainer support
