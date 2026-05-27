# Server Management

**File**: `src/OpenCodeServer.ts`

## Binary Detection

**Method**: `findBinaryPath()`

Search order:

1. **System PATH** via `which opencode` (or `where opencode.exe` on Windows).
2. **Local npm modules** (6 paths checked in order):
   - `node_modules/opencode-ai/bin/.opencode`
   - `node_modules/opencode-{platform}-{arch}/bin/opencode`
   - `node_modules/opencode-{platform}-{arch}-baseline/bin/opencode`
   - `node_modules/opencode-{platform}-{arch}-musl/bin/opencode`
   - `node_modules/opencode-{platform}-{arch}-baseline-musl/bin/opencode`
3. **npm bin wrappers**: `node_modules/.bin/opencode` (or `.cmd` on Windows).
4. **Direct path**: `node_modules/opencode-ai/bin/opencode`.

## Server Start

**Method**: `start()`

1. Validates not already running.
2. Resets all state (`_port`, `_processExited`, `_outputBuffer`, etc.).
3. Reads `hostname` from settings (default `127.0.0.1`).
4. **If remote environment + devcontainer mode**: tries `detectExistingServer()` first (see [server-detection.md](server-detection.md)).
5. Finds binary path (auto-installs in remote if missing).
6. Spawns: `opencode serve --port 0 --hostname <hostname>`.
7. Passes `OPENCODE_SERVER_PASSWORD` from environment.
8. Sets up stdout/stderr handlers that:
   - Append to both `OutputChannel` and in-memory buffer (10KB cap, 5KB tail truncation).
   - Detect port from output via regex `/listening on https?://[^:]+:(\d+)/i`.
9. Waits for server readiness (`waitForServer`):
   - Polls `/global/health` endpoint every 500ms.
   - 30-second timeout.
   - Checks for premature process exit.
10. Starts HTTP proxy (`startProxy`).
11. Resolves webview URL.
12. Fires `onDidChangeStatus(true)`.

## Server Stop

**Method**: `stop()`

1. **If connected to existing server**: stops proxy, clears state, fires `onDidChangeStatus(false)`.
2. **If managing own server**:
   - Posts `POST /instance/dispose` to the OpenCode server for graceful shutdown.
   - Stops the proxy.
   - Sends `SIGTERM` to the process.
   - Waits 1 second for cleanup.
   - Calls `cleanup()` which sets `_isRunning = false`, nulls the process, stops proxy, fires `onDidChangeStatus(false)`.

## Server Restart

**Method**: `restart()`

- Calls `stop()` → waits 500ms → calls `start()`.

## Binary Installation

**Method**: `installBinary()`

- Creates a `Pseudoterminal` to show real-time npm output.
- Shows a VS Code progress notification with a progress bar (estimated 30s duration, max 90% until completion).
- Runs `npm install opencode-ai@latest --no-audit --no-fund` in the extension directory.
- STDERR output updates both the pseudoterminal and the progress bar.
- On success: shows "Installation complete!".
- On failure: rejects with exit code or error message.

## Output Channel

- Channel name: `OpenCode Server` (accessible via VS Code Output panel).
- All server stdout/stderr is written here.
- Also used for informational messages (detection logs, proxy status, errors).

## Status Bar

- Shown in the VS Code status bar (left side, priority 100).
- **Connected**: `$(globe) OpenCode: Connected` with tooltip showing port.
- **Disconnected**: `$(globe) OpenCode: Disconnected` with warning background color.
- Clicking the status bar focuses the OpenCode panel.

## Related Specs

- [server-detection.md](server-detection.md)
- [remote-environments.md](remote-environments.md)
- [../operations/extension-lifecycle.md](../operations/extension-lifecycle.md)
