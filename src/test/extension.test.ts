import * as assert from 'assert';
import * as vscode from 'vscode';
import { OpenCodeServer } from '../OpenCodeServer';
import * as path from 'path';

function createMockContext(): vscode.ExtensionContext {
  return {
    subscriptions: [],
    extensionPath: path.resolve(__dirname, '..', '..'),
    extensionUri: vscode.Uri.file(path.resolve(__dirname, '..', '..')),
    extensionMode: vscode.ExtensionMode.Test,
    globalState: { get: () => undefined, update: async () => undefined, keys: () => [], setKeysForSync: () => {} } as any,
    workspaceState: { get: () => undefined, update: async () => undefined, keys: () => [] } as any,
    secrets: { get: async () => undefined, store: async () => {}, delete: async () => {} } as any,
    storageUri: null,
    storagePath: null,
    globalStorageUri: null as any,
    globalStoragePath: null as any,
    logUri: null as any,
    logPath: null as any,
    extension: null as any,
    environmentVariableCollection: null as any,
    asAbsolutePath: (p: string) => path.resolve(__dirname, '..', '..', p),
  } as unknown as vscode.ExtensionContext;
}

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Commands are registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('opencode-sidebar-web.openPanel'));
    assert.ok(commands.includes('opencode-sidebar-web.closePanel'));
    assert.ok(commands.includes('opencode-sidebar-web.startServer'));
    assert.ok(commands.includes('opencode-sidebar-web.stopServer'));
    assert.ok(commands.includes('opencode-sidebar-web.restartServer'));
    assert.ok(commands.includes('opencode-sidebar-web.openFile'));
  });

  suite('OpenCodeServer', () => {
    let context: vscode.ExtensionContext;

    setup(() => {
      context = createMockContext();
    });

    test('findBinaryPath searches system PATH as first fallback', () => {
      const server = new OpenCodeServer(context);
      if (server.isBinaryInstalled()) {
        const path = server['findBinaryPath']();
        assert.ok(path !== undefined, 'Binary path should be found');
      }
    });

    test('Server constructor accepts mock context', () => {
      const server = new OpenCodeServer(context);
      assert.ok(server instanceof OpenCodeServer);
      assert.ok(server.outputChannel !== undefined);
    });
  });

  suite('Start and stop server', () => {
    let context: vscode.ExtensionContext;

    setup(() => {
      context = createMockContext();
    });

    test('Server start and health check', async () => {
      const server = new OpenCodeServer(context);
      try {
        await server.start();
        assert.ok(server.isRunning);
        assert.ok(server.port > 0);
        assert.ok(server.proxyPort > 0);
        assert.ok(server.proxyUrl.includes(String(server.proxyPort)));
      } finally {
        await server.stop();
      }
    });

    test('Server stop cleans up', async () => {
      const server = new OpenCodeServer(context);
      await server.start();
      assert.ok(server.isRunning);
      await server.stop();
      assert.ok(!server.isRunning);
    });
  });
});
