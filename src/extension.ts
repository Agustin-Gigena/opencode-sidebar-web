import * as vscode from 'vscode';
import { OpenCodeServer } from './OpenCodeServer';
import { OpenCodePanel } from './OpenCodePanel';

let server: OpenCodeServer | undefined;
let panel: OpenCodePanel | undefined;
let serverWasEverRunning = false;

export async function activate(context: vscode.ExtensionContext) {
  server = new OpenCodeServer(context);
  panel = new OpenCodePanel(context.extensionUri, server, startServer);

  if (!server.isBinaryInstalled()) {
    const install = await vscode.window.showInformationMessage(
      'OpenCode binary not found. Install it now?',
      'Install'
    );
    if (install === 'Install') {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Installing OpenCode...' },
        async () => { await server!.installBinary(); }
      );
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.openPanel', async () => {
      if (panel!.isVisible) {
        panel!.close();
        return;
      }
      await panel!.show();
      if (!server!.isRunning) {
        await startServer();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.focusPanel', async () => {
      await panel!.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.closePanel', () => {
      panel!.close();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.startServer', startServer)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.stopServer', async () => {
      reconnectCanceled = true;
      panel?.clearState();
      await server?.stop();
      panel?.render();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.restartServer', async () => {
      panel?.clearState();
      await server?.restart();
      panel?.render();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.openFile', async (uri: vscode.Uri | string) => {
      const fileUri = typeof uri === 'string' ? vscode.Uri.parse(uri) : uri;
      await vscode.commands.executeCommand('vscode.open', fileUri);
    })
  );

  server.onDidChangeStatus((running) => {
    if (running) {
      serverWasEverRunning = true;
      panel?.clearState();
      panel?.render();
    } else if (serverWasEverRunning) {
      panel?.markCrashed();
      attemptReconnect();
    }
  });

  const config = vscode.workspace.getConfiguration('opencode-sidebar-web');
  if (config.get('autoStart', false)) {
    server.start()
      .then(() => panel?.render())
      .catch((err) => console.error('Auto-start failed:', err));
  }
}

async function startServer(): Promise<void> {
  if (!server || server.isRunning) { return; }
  reconnectCanceled = true;

  try {
    await server.start();
    panel?.render();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    panel?.setError(msg);
    vscode.window.showErrorMessage(
      `Failed to start OpenCode server: ${msg}`
    );
  }
}

let reconnectCanceled = false;

async function attemptReconnect(): Promise<void> {
  const config = vscode.workspace.getConfiguration('opencode-sidebar-web');
  if (!config.get('autoReconnect', true)) { return; }

  const maxAttempts = config.get('maxReconnectAttempts', 3);
  for (let i = 0; i < maxAttempts; i++) {
    const delay = Math.pow(2, i) * 1000;
    await new Promise((r) => setTimeout(r, delay));
    if (reconnectCanceled || !server || server.isRunning || !panel?.isVisible) { return; }
    try {
      await server.start();
      return;
    } catch { /* next attempt */ }
  }
}

export async function deactivate(): Promise<void> {
  reconnectCanceled = true;
  await server?.dispose();
  panel = undefined;
  server = undefined;
}
