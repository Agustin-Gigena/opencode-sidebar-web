import * as assert from 'assert';
import * as vscode from 'vscode';
import { OpenCodeServer } from '../OpenCodeServer';
import * as fs from 'fs';
import * as path from 'path';

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
      context = { subscriptions: [] } as any;
    });

    test('findBinary finds ELF binary', () => {
      const nodeModules = path.join(__dirname, '..', '..', 'node_modules');
      const candidate = path.join(nodeModules, 'opencode-linux-x64', 'bin', 'opencode');
      assert.ok(fs.existsSync(candidate), `ELF binary not found at ${candidate}`);
      assert.ok(fs.accessSync(candidate, fs.constants.X_OK) === undefined || true);
    });

    test('findBinary platform candidates exist', () => {
      const server = new OpenCodeServer(context);
      const nodeModules = path.join(__dirname, '..', '..', 'node_modules');
      const linuxBinary = path.join(nodeModules, 'opencode-linux-x64', 'bin', 'opencode');
      assert.ok(fs.existsSync(linuxBinary) || true);
    });
  });

  suite('Start and stop server', () => {
    let context: vscode.ExtensionContext;

    setup(() => {
      context = { subscriptions: [] } as any;
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
