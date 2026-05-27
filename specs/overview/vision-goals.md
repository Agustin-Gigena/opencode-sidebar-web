# Vision and Goals

## Purpose

Integrate the OpenCode web interface as a native VS Code secondary sidebar panel, enabling users to interact with OpenCode without leaving the editor.

## Goals

- Provide a seamless OpenCode experience inside VS Code.
- Auto-start and manage the OpenCode server lifecycle (start, stop, restart).
- Support remote/devcontainer environments transparently (auto-detect, auto-install, proxy).
- Detect and connect to existing OpenCode servers running on the host/remote.
- Offer a polished, native-feeling webview panel with status bar, error states, and reconnect logic.
- Stream binary installation via pseudoterminal with progress reporting.

## Non-Goals

- Reimplement the OpenCode web UI.
- Support editors other than VS Code.
- Replace the OpenCode CLI.
- Support multiple simultaneous server instances.

## Scope

- **Included**: extension activation, server lifecycle, webview panel, remote/devcontainer support, binary detection and installation, existing server detection, auto-reconnect, status bar, output channel logging, settings integration.
- **Excluded**: authentication management, multi-root workspace support, OpenCode web UI modifications.
