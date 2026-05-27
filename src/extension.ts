import * as vscode from 'vscode';
import { OpenCodeServer } from './OpenCodeServer';
import { OpenCodePanel } from './OpenCodePanel';
import { OpenCodeAPI } from './OpenCodeAPI';
import { CodeLensProvider } from './CodeLensProvider';

let server: OpenCodeServer | undefined;
let panel: OpenCodePanel | undefined;
let serverWasEverRunning = false;

export async function activate(context: vscode.ExtensionContext) {
  server = new OpenCodeServer(context);
  panel = new OpenCodePanel(context.extensionUri, server, startServer);
  vscode.commands.executeCommand('setContext', 'opencodeSidebarServerRunning', false);
  vscode.commands.executeCommand('setContext', 'opencodeSidebarBinaryInstalled', server.isBinaryInstalled());

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(OpenCodePanel.viewType, panel)
  );

  const devcontainerMode = vscode.workspace.getConfiguration('opencode-sidebar-web')
    .get('devcontainerMode', true);

  if (server.isRemoteEnvironment() && devcontainerMode) {
    const existing = await server.detectExistingServer();
    if (existing) {
      await server.connectToExisting(existing);
      panel?.render();
    } else if (!server.isBinaryInstalled()) {
      const autoInstall = vscode.workspace.getConfiguration('opencode-sidebar-web')
        .get('autoInstallInDevcontainer', true);
      if (autoInstall) {
        try {
          await server.installBinary();
          vscode.commands.executeCommand('setContext', 'opencodeSidebarBinaryInstalled', true);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          const viewTerminal = 'View Terminal';
          const result = await vscode.window.showErrorMessage(
            `Auto-install failed: ${msg}`, viewTerminal
          );
          if (result === viewTerminal) { server.installTerminal?.show(); }
        }
      }
    }
  } else if (!server.isBinaryInstalled()) {
    const action = await vscode.window.showInformationMessage(
      'OpenCode binary not found. Install it now?',
      'Install', 'View Details'
    );
    if (action === 'View Details') {
      server.outputChannel.show();
    } else if (action === 'Install') {
      try {
        await server!.installBinary();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        const viewTerminal = 'View Terminal';
        const result = await vscode.window.showErrorMessage(
          `Installation failed: ${msg}`, viewTerminal
        );
        if (result === viewTerminal) {server!.installTerminal?.show();}
        throw err;
      }
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
      reconnectCanceled = true;
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

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.installBinary', async () => {
      if (server!.isBinaryInstalled()) {
        const action = await vscode.window.showInformationMessage(
          'OpenCode is already installed. Reinstall?',
          'Reinstall', 'Cancel'
        );
        if (action !== 'Reinstall') { return; }
      }
      try {
        await server!.installBinary();
        vscode.commands.executeCommand('setContext', 'opencodeSidebarBinaryInstalled', true);
        vscode.window.showInformationMessage('OpenCode binary installed successfully.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        const viewTerminal = 'View Terminal';
        const result = await vscode.window.showErrorMessage(
          `Installation failed: ${msg}`, viewTerminal
        );
        if (result === viewTerminal) { server!.installTerminal?.show(); }
        throw err;
      }
    })
  );

  const api = OpenCodeAPI.fromServer(server);
  const codeLensProvider = new CodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ pattern: '**/*' }, codeLensProvider)
  );

  const codeActionPrompts: Record<string, string> = {
    explain: 'Explain the following code concisely, focusing on what it does and why.',
    refactor: 'Suggest a refactored version of this code. Show the improved version and explain why it\'s better.',
    fix: 'Identify bugs or issues in this code and provide fixes.',
    docs: 'Generate JSDoc-style documentation for this code.',
  };

  async function handleCodeAction(
    code: string | undefined,
    range: vscode.Range | undefined,
    action: keyof typeof codeActionPrompts
  ): Promise<void> {
    if (!code) {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showInformationMessage('No code selected.');
        return;
      }
      code = editor.document.getText(editor.selection);
      range = new vscode.Range(editor.selection.start, editor.selection.end);
    }

    if (!server?.isRunning) {
      const startAction = 'Start Server';
      const result = await vscode.window.showErrorMessage(
        'OpenCode server is not running.',
        startAction
      );
      if (result === startAction) {
        await startServer();
      }
      return;
    }

    try {
      const result = await api.complete(code, codeActionPrompts[action]);

      if (action === 'refactor' || action === 'fix') {
        const label = action === 'refactor' ? 'Apply suggestion?' : 'Apply fix?';
        const choice = await vscode.window.showQuickPick(
          ['Apply', 'Preview Diff', 'Cancel'],
          { placeHolder: label }
        );

        if (choice === 'Apply') {
          const editor = vscode.window.activeTextEditor;
          if (editor && range) {
            await editor.edit((editBuilder) => {
              editBuilder.replace(range!, result);
            });
          }
        } else if (choice === 'Preview Diff') {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            const suggestedDoc = await vscode.workspace.openTextDocument({
              content: result,
              language: editor.document.languageId,
            });
            await vscode.commands.executeCommand(
              'vscode.diff',
              editor.document.uri,
              suggestedDoc.uri,
              action === 'refactor' ? 'Refactored Version' : 'Fixed Version'
            );
          }
        }
      } else {
        const decorationType = vscode.window.createTextEditorDecorationType({
          backgroundColor: 'rgba(0, 122, 204, 0.1)',
          overviewRulerColor: 'rgba(0, 122, 204, 0.3)',
        });
        context.subscriptions.push(decorationType);

        const editor = vscode.window.activeTextEditor;
        if (editor && range) {
          editor.setDecorations(decorationType, [
            {
              range,
              hoverMessage: new vscode.MarkdownString(result),
            },
          ]);

          vscode.window.showInformationMessage(
            action === 'explain'
              ? 'Explanation ready \u2014 hover over the selection to see it.'
              : 'Documentation generated \u2014 hover over the selection to see it.'
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      vscode.window.showErrorMessage(`OpenCode action failed: ${msg}`);
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.explainSelection', async (code?: string, range?: vscode.Range) => {
      await handleCodeAction(code, range, 'explain');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.refactorSelection', async (code?: string, range?: vscode.Range) => {
      await handleCodeAction(code, range, 'refactor');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.fixSelection', async (code?: string, range?: vscode.Range) => {
      await handleCodeAction(code, range, 'fix');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-sidebar-web.docsSelection', async (code?: string, range?: vscode.Range) => {
      await handleCodeAction(code, range, 'docs');
    })
  );

  server.onDidChangeStatus((running) => {
    vscode.commands.executeCommand('setContext', 'opencodeSidebarServerRunning', running);
    if (running) {
      reconnectCanceled = false;
      serverWasEverRunning = true;
      panel?.clearState();
      panel?.render();
    } else if (serverWasEverRunning) {
      panel?.markCrashed();
      attemptReconnect();
    }
  });

  positionPanel();
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

function positionPanel(): void {
  const config = vscode.workspace.getConfiguration('opencode-sidebar-web');
  if (config.get('autoStart', false)) {
    server!.start()
      .then(() => panel?.render())
      .catch((err) => console.error('Auto-start failed:', err));
  }
}

export async function deactivate(): Promise<void> {
  reconnectCanceled = true;
  await server?.dispose();
  panel = undefined;
  server = undefined;
}
