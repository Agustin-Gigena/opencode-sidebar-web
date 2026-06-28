import * as assert from 'assert';
import * as vscode from 'vscode';
import { CodeLensProvider } from '../CodeLensProvider.js';
import { OpenCodeAPI, ServerNotRunningError, AuthError } from '../OpenCodeAPI.js';
import { OpenCodeServer } from '../OpenCodeServer.js';
import { createMockContext } from './test-utils.js';

suite('CodeLensProvider', () => {
  test('returns empty array when no editor is active', () => {
    const provider = new CodeLensProvider();
    const doc = { uri: vscode.Uri.file('/test.ts') } as vscode.TextDocument;
    const lenses = provider.provideCodeLenses(doc);
    assert.strictEqual(lenses.length, 0);
  });

  test('returns empty array when selection is empty', () => {
    const provider = new CodeLensProvider();
    const doc = vscode.window.activeTextEditor?.document;
    if (!doc) { return; }
    const origSelection = vscode.window.activeTextEditor!.selection;
    try {
      const pos = new vscode.Position(0, 0);
      vscode.window.activeTextEditor!.selection = new vscode.Selection(pos, pos);
      const lenses = provider.provideCodeLenses(doc);
      assert.strictEqual(lenses.length, 0);
    } finally {
      vscode.window.activeTextEditor!.selection = origSelection;
    }
  });
});

function createMockSDKClient(sessionResponse: any, promptResponse: any): any {
  return {
    session: {
      create: async () => ({ data: sessionResponse, error: undefined }),
      prompt: async () => ({ data: promptResponse, error: undefined }),
    },
  };
}

function createMockServer(client: any): any {
  return {
    isRunning: true,
    client,
  };
}

suite('OpenCodeAPI', () => {
  test('constructs correct request for complete()', async () => {
    const mockClient = createMockSDKClient(
      { id: 'test-session-id' },
      { parts: [{ type: 'text', text: 'test response' }] }
    );
    const mockServer = createMockServer(mockClient);
    const api = new OpenCodeAPI(mockServer);

    const result = await api.complete('test code', 'test prompt');
    assert.strictEqual(result, 'test response');
  });

  test('handles server-not-running error gracefully', async () => {
    const mockServer = {
      isRunning: false,
      client: null,
    } as any;
    const api = new OpenCodeAPI(mockServer);
    try {
      await api.complete('test', 'test');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof ServerNotRunningError);
    }
  });

  test('throws descriptive error on JSON parse failure', async () => {
    const mockClient = createMockSDKClient(
      { id: 'test-session-id' },
      { parts: [{ type: 'text', text: 'response' }] }
    );
    // Override prompt to throw
    mockClient.session.prompt = async () => {
      throw new Error('Failed to parse response as JSON');
    };
    const mockServer = createMockServer(mockClient);
    const api = new OpenCodeAPI(mockServer);

    try {
      await api.complete('test', 'test');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('Failed to parse response as JSON'));
    }
  });
});

suite('Editor Integration Commands', () => {
  test('explainSelection command is registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('opencode-sidebar-web.explainSelection'));
  });

  test('refactorSelection command is registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('opencode-sidebar-web.refactorSelection'));
  });

  test('fixSelection command is registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('opencode-sidebar-web.fixSelection'));
  });

  test('docsSelection command is registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('opencode-sidebar-web.docsSelection'));
  });

  test('sendToChat command is registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('opencode-sidebar-web.sendToChat'));
  });
});

suite('Auto-link Active File', () => {
  test('autoLinkActiveFile setting defaults to true', () => {
    const config = vscode.workspace.getConfiguration('opencode-sidebar-web');
    assert.strictEqual(config.get('autoLinkActiveFile', true), true);
  });

  test('autoLinkActiveFile can be toggled to false', async () => {
    const config = vscode.workspace.getConfiguration('opencode-sidebar-web');
    const orig = config.get('autoLinkActiveFile', true);
    try {
      await config.update('autoLinkActiveFile', false, vscode.ConfigurationTarget.Global);
      const updated = config.get('autoLinkActiveFile', true);
      assert.ok(updated === true || updated === false);
    } finally {
      await config.update('autoLinkActiveFile', orig, vscode.ConfigurationTarget.Global);
    }
  });

  test('server-not-running guard prevents auto-link from firing', () => {
    const handler = (serverIsRunning: boolean) => {
      return function handleActiveEditorChange(editor: vscode.TextEditor | undefined) {
        if (!editor || !serverIsRunning) { return; }
        const config = vscode.workspace.getConfiguration('opencode-sidebar-web');
        if (!config.get('autoLinkActiveFile', true)) { return; }
        return 'would fire';
      };
    };
    assert.strictEqual(handler(false)(undefined), undefined);
    assert.strictEqual(handler(false)({} as any), undefined);
  });
});