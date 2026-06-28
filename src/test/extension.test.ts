import * as assert from 'assert';
import * as vscode from 'vscode';
import { OpenCodeServer } from '../OpenCodeServer.js';
import { createMockContext } from './test-utils.js';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Commands are registered', async () => {
    const ext = vscode.extensions.getExtension('agustin-gigena.opencode-sidebar-web');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('opencode-sidebar-web.openPanel'));
    assert.ok(commands.includes('opencode-sidebar-web.closePanel'));
    assert.ok(commands.includes('opencode-sidebar-web.startServer'));
    assert.ok(commands.includes('opencode-sidebar-web.stopServer'));
    assert.ok(commands.includes('opencode-sidebar-web.restartServer'));
    assert.ok(commands.includes('opencode-sidebar-web.openFile'));
    assert.ok(commands.includes('opencode-sidebar-web.focusPanel'));
    assert.ok(commands.includes('opencode-sidebar-web.explainSelection'));
    assert.ok(commands.includes('opencode-sidebar-web.refactorSelection'));
    assert.ok(commands.includes('opencode-sidebar-web.fixSelection'));
    assert.ok(commands.includes('opencode-sidebar-web.docsSelection'));
    assert.ok(commands.includes('opencode-sidebar-web.sendToChat'));
  });
});

suite('OpenCodeServer', () => {
  let context: vscode.ExtensionContext;

  setup(() => {
    context = createMockContext();
  });

  test('Server constructor accepts mock context', () => {
    const server = new OpenCodeServer(context);
    assert.ok(server instanceof OpenCodeServer);
    assert.ok(server.outputChannel !== undefined);
  });

  test('webviewUrl getter does not throw when not running', () => {
    const server = new OpenCodeServer(context);
    assert.strictEqual(typeof server.webviewUrl, 'string');
  });
});


suite('Start and stop server', function () {
  this.timeout(60000);
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

  test('Server webviewUrl is set after start', async () => {
    const server = new OpenCodeServer(context);
    try {
      await server.start();
      assert.ok(server.webviewUrl.length > 0);
      assert.ok(server.webviewUrl.startsWith('http://'));
    } finally {
      await server.stop();
    }
  });
});