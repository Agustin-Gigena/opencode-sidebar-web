# Server Detection — **DEPRECATED**

**Status**: Obsoleted by Phase 10 (Embedded Binary via GitHub Releases)

The new architecture (Phase 10) runs the OpenCode binary **locally** (downloaded/cached from GitHub Releases). The binary is always spawned by the extension. There is no need to detect or connect to an existing external server.

## What Was Removed

- `OpenCodeServer.detectExistingServer()`
- `OpenCodeServer.connectToExisting()`
- `OpenCodeServer.isConnectedToExisting` getter
- Process table scanning (`pgrep`, `/proc/<pid>/cmdline`)
- Environment variable detection (`OPENCODE_URL`, `OPENCODE_PORT`)
- Health-check-based candidate verification
- Frame-blocking header detection for external servers

## Migration

The extension now:
1. Downloads the configured opencode version to `globalStorageUri/opencode-bin/<version>/`
2. Spawns it locally with `serve --port 0 --hostname 127.0.0.1`
3. The workspace folder (which can be remote via VS Code SSH/devcontainer) is passed as `cwd`
4. The proxy still runs locally to strip CSP headers for iframe embedding

See [2026-06-26-embedded-binary-design.md](2026-06-26-embedded-binary-design.md) for the new design.