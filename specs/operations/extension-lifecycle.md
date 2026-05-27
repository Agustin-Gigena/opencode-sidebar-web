# Extension Lifecycle

**File**: `src/extension.ts`

## Activation

On activation, the extension:

1. Creates `OpenCodeServer` and `OpenCodePanel` instances.
2. Sets VS Code context variables:
   - `opencodeSidebarServerRunning` → `false`
   - `opencodeSidebarBinaryInstalled` → result of `server.isBinaryInstalled()`
3. Registers the `WebviewViewProvider` for `opencode-sidebar-web.view`.
4. **If remote environment + devcontainer mode enabled**:
   - Attempts to detect an existing server via `detectExistingServer()`.
   - If found, connects to it via `connectToExisting()` and renders the panel.
   - If not found and binary not installed, optionally auto-installs (`autoInstallInDevcontainer` setting).
5. **If local environment and binary not installed**:
   - Prompts the user: "OpenCode binary not found. Install it now?" with `Install` or `View Details` options.
   - On `Install`, calls `server.installBinary()`.
6. Registers all 7 commands (see Commands section).
7. Subscribes to server status changes (`onDidChangeStatus`) for auto-reconnect logic.
8. Calls `positionPanel()` which auto-starts the server if `autoStart` is enabled.

## Commands

| Command ID | Trigger | Behavior |
|---|---|---|
| `openPanel` | Command palette, editor title button, keybinding (`Ctrl+Shift+O`) | Toggles panel visibility; if opening and server not running, starts it |
| `closePanel` | Command palette, panel UI | Closes the panel via `workbench.action.agentToggleSecondarySidebarVisibility` |
| `focusPanel` | Command palette | Shows the panel without toggling |
| `startServer` | Command palette, view title button | Starts the OpenCode server |
| `stopServer` | Command palette, view title button | Clears panel state, stops server, re-renders panel |
| `restartServer` | Command palette, view title button | Clears panel state, restarts server, re-renders panel |
| `openFile` | Internal | Opens a file via URI (used by webview) |
| `installBinary` | View title button | Installs/reinstalls the OpenCode binary |

## Status Change Events

When `OpenCodeServer` fires `onDidChangeStatus(running)`:

- **running = true**: resets reconnect flag, marks `serverWasEverRunning`, clears panel state, re-renders panel.
- **running = false AND server was ever running**: marks panel as crashed, starts auto-reconnect loop.

## Auto-Reconnect

**Function**: `attemptReconnect()`

- Only runs if `autoReconnect` setting is `true` (default).
- Up to `maxReconnectAttempts` (default 3) attempts.
- Exponential backoff: 2^N seconds delay (1s, 2s, 4s).
- Cancelled if: `reconnectCanceled` flag is set, server becomes running, or panel is hidden.
- Each attempt calls `server.start()`.

## Deactivation

1. Sets `reconnectCanceled = true` to stop any pending reconnect.
2. Calls `server.dispose()` which stops the server + proxy + disposes output channel and status bar.
3. Clears panel and server references.

## Settings Used

| Setting | Where read | Purpose |
|---|---|---|
| `autoStart` | `positionPanel()` | Start server on activation |
| `hostname` | `OpenCodeServer.start()` | Server bind hostname |
| `autoReconnect` | `attemptReconnect()` | Enable reconnect |
| `maxReconnectAttempts` | `attemptReconnect()` | Max reconnect attempts |
| `devcontainerMode` | `activate()`, `OpenCodeServer.start()` | Remote/devcontainer support |
| `autoInstallInDevcontainer` | `activate()` | Auto-install in remote |

## Related Specs

- [server/server-management.md](../server/server-management.md)
- [panel/webview-panel.md](../panel/webview-panel.md)
- [server/remote-environments.md](../server/remote-environments.md)
