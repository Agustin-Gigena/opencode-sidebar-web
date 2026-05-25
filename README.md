# OpenCode Sidebar Web

Integrates the OpenCode web UI into a VS Code sidebar panel.

## Features

- Opens OpenCode web interface in the secondary sidebar (right side)
- Starts the OpenCode server on-demand or automatically
- Editor title button to toggle the panel open/close
- Status bar indicator showing connection state
- Auto-reconnect when the server disconnects
- Theme sync: OpenCode follows VS Code's light/dark theme
- Proxy with CSP header stripping for secure iframe embedding
- Full support for remote development and devcontainers:
  - Automatic remote environment detection
  - Auto-connect to existing server in remote
  - Dynamic CSP and webview URL via `asExternalUri` proxy
  - Auto-install opencode binary inside devcontainer
- Command to install opencode binary from VS Code
- "View Logs" and "Settings" links in the panel

## Usage

- Click the OpenCode icon in the editor title bar
- Or press `Ctrl+Shift+O` (`Cmd+Shift+O` on macOS)
- Click "Start Server" in the panel to start the OpenCode server
- The OpenCode web UI will load inside the panel

## Extension Settings

This extension contributes the following settings:

- `opencode-sidebar-web.autoStart`: Automatically start the OpenCode server when VS Code opens
- `opencode-sidebar-web.autoReconnect`: Automatically reconnect when the server disconnects
- `opencode-sidebar-web.maxReconnectAttempts`: Maximum number of reconnection attempts (default: 3)
- `opencode-sidebar-web.hostname`: Hostname for the OpenCode server (default: 127.0.0.1)
- `opencode-sidebar-web.hideButton`: Hide the OpenCode button from the editor title bar
- `opencode-sidebar-web.devcontainerMode`: Detect opencode running in devcontainer/remote automatically
- `opencode-sidebar-web.autoInstallInDevcontainer`: Auto-install opencode on activation in devcontainer if not present
- `opencode-sidebar-web.sidebarPosition`: Always secondary sidebar (right side)

## Requirements

- VS Code 1.118.0 or higher
- The `opencode-ai` npm package (bundled)
