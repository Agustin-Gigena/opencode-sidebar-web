# Remote Environments — **DEPRECATED**

**Status**: Obsoleted by Phase 10 (Embedded Binary via GitHub Releases)

The new architecture (Phase 10) runs the OpenCode binary **locally on the client machine** (where VS Code UI runs). The workspace folder (which can be remote via SSH, devcontainer, Codespaces, WSL) is passed as `cwd` to the local opencode process.

## What Was Removed

- `OpenCodeServer.isRemoteEnvironment()` check
- `devcontainerMode` setting
- `autoInstallInDevcontainer` setting
- Devcontainer-specific activation flow
- Auto-install in remote environments
- Remote proxy URL resolution via `vscode.env.asExternalUri`
- Frame-blocking header detection for remote servers
- Process detection via `pgrep` in remote containers

## New Behavior

| Scenario | Old Behavior | New Behavior |
|---|---|---|
| Local workspace | Start local binary | Start local binary (unchanged) |
| SSH remote workspace | Detect/start in container | Start local binary, `cwd` = remote workspace path |
| Devcontainer | Detect/start in container | Start local binary, `cwd` = mounted workspace |
| Codespaces | Detect/start in codespace | Start local binary, `cwd` = remote workspace |

The local binary has full access to the remote filesystem via VS Code's FileSystemProvider (the `cwd` path works transparently).

## Settings Removed

- `opencode-sidebar-web.devcontainerMode`
- `opencode-sidebar-web.autoInstallInDevcontainer`

## Commands Removed

- `opencode-sidebar-web.installBinary` (no longer needed)

## Related Specs

- [server-detection.md](server-detection.md) (also deprecated)
- [2026-06-26-embedded-binary-design.md](2026-06-26-embedded-binary-design.md) (current design)