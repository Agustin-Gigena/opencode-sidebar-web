# Server Detection

**File**: `src/OpenCodeServer.ts` — methods `detectExistingServer()` and `connectToExisting()`

## Purpose

Detect an already-running OpenCode server on the system and connect to it instead of starting a new one. This is critical for remote/devcontainer environments where the server may be running on the host or in another container.

## Detection Strategy

**Method**: `detectExistingServer()` → returns `DetectedServer | null`

Candidates are collected and health-checked in order:

### 1. Environment Variables

| Variable | Example | Result |
|---|---|---|
| `OPENCODE_URL` | `http://host:4096` | Full URL used directly |
| `OPENCODE_PORT` | `4096` | URL constructed as `http://127.0.0.1:<port>` |
| `OPENCODE_SERVER_PASSWORD` | `secret` | Added as Basic auth header for health checks |

### 2. Process Table (Linux only)

- Runs `pgrep -x opencode` to find PIDs.
- Reads `/proc/<pid>/cmdline` to extract `--port` and `--hostname` arguments.
- Constructs URL for each running instance.

### 3. Default Port

- If the binary is installed, appends `http://127.0.0.1:4096` (the default OpenCode port).

### Health Check

For each candidate URL:

- `GET /global/health` with 2-second timeout.
- If `OPENCODE_SERVER_PASSWORD` is set, sends `Authorization: Basic <base64("opencode:password")>`.
- Returns the first candidate that responds with HTTP 200.

## Connection

**Method**: `connectToExisting(detected: DetectedServer)`

1. Stores the existing URL and parses it for hostname and port.
2. **Checks for frame-blocking headers** (`checkNeedsProxy`):
   - Fetches `/global/health`.
   - Scans for `X-Frame-Options` and `Content-Security-Policy` with `frame-ancestors`.
   - If either is present, starts the proxy.
3. **Resolves webview URL**:
   - **With proxy**: uses proxy URL, then resolves via `vscode.env.asExternalUri` in remote environments.
   - **Without proxy**: uses the detected URL directly (or resolved external URI in remote).
4. Fires `onDidChangeStatus(true)`.

## State

- `isConnectedToExisting` getter returns `true` when connected to an external server.
- `stop()` behavior differs: only stops the proxy, never sends `SIGTERM` or `/instance/dispose`.

## Related Specs

- [server-management.md](server-management.md)
- [remote-environments.md](remote-environments.md)
- [../panel/webview-panel.md](../panel/webview-panel.md)
