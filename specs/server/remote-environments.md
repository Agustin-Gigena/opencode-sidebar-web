# Remote Environments

## Detection

**Method**: `OpenCodeServer.isRemoteEnvironment()`

- Returns `true` when `vscode.env.remoteName !== undefined`.
- Covers all remote scenarios: SSH, devcontainers, GitHub Codespaces, WSL.

## Devcontainer Configuration

**File**: `.devcontainer/devcontainer.json`

- Uses `mcr.microsoft.com/devcontainers/typescript-node:22` image.
- Forwards port 4096 for OpenCode server access.
- Runs `npm install` as post-create command.
- Pre-installs VS Code extensions: `github.vscode-github-actions`, `ms-vscode.extension-test-runner`.
- Sets `opencode-sidebar-web.devcontainerMode: true` by default.

## Activation Flow (Remote)

During `activate()` in `src/extension.ts`:

1. `isRemoteEnvironment()` + `devcontainerMode` setting (default: `true`).
2. Calls `detectExistingServer()` to find a running OpenCode server.
3. **If found**: connects via `connectToExisting()`, renders panel.
4. **If not found + binary not installed + `autoInstallInDevcontainer` enabled**: silently auto-installs via `installBinary()`.
5. **If auto-install fails**: shows error with "View Terminal" option.

## Server Start Flow (Remote)

During `OpenCodeServer.start()`:

1. Checks `isRemoteEnvironment() + devcontainerMode`.
2. If true, runs `detectExistingServer()` first.
3. **If existing server found**: connects to it (no new process spawned).
4. **If not found + no binary**: calls `installBinary()` to get the binary, then starts normally.

## Proxy and URL Resolution

**In remote environments**, the proxy architecture is critical:

1. OpenCode server starts on `127.0.0.1:<port>` inside the container/remote.
2. HTTP proxy starts on `127.0.0.1:<proxyPort>` to strip frame-blocking headers.
3. `vscode.env.asExternalUri(localUri)` converts `http://127.0.0.1:<proxyPort>` to an externally-accessible URL (e.g., `https://<codespace>.<port>.github.dev`).
4. The resolved external URI is used as the iframe `src`.

**Without proxy**: If the detected server has no frame-blocking headers, `vscode.env.asExternalUri` is called directly on the server URL.

## Frame-Blocking Header Detection

**Method**: `checkNeedsProxy(detected: DetectedServer)`

- Fetches the server's `/global/health` endpoint.
- Checks for:
  - `X-Frame-Options` header (any value).
  - `Content-Security-Policy` header containing `frame-ancestors`.
- If either is found, the proxy is started.
- On fetch error (timeout, connection refused), assumes proxy is needed.

## Existing Server Detection in Remote

The detection finds servers running on the host machine:
1. `OPENCODE_URL` / `OPENCODE_PORT` env vars are tried first.
2. `pgrep -x opencode` + `/proc/<pid>/cmdline` parsing works for servers running in the same container.
3. Default port `4096` is checked as fallback.
4. Each candidate is verified via health check before connecting.

## Security Considerations

- The proxy only listens on `127.0.0.1` (localhost).
- The proxy strips `Content-Security-Policy` headers; VS Code's own CSP on the webview provides a defense layer.
- `OPENCODE_SERVER_PASSWORD` is forwarded as Basic auth if present.
- The pseudoterminal for binary installation is non-interactive (cannot accept input).

## Related Specs

- [server-detection.md](server-detection.md)
- [server-management.md](server-management.md)
- [../panel/webview-panel.md](../panel/webview-panel.md)
- [../operations/extension-lifecycle.md](../operations/extension-lifecycle.md)
