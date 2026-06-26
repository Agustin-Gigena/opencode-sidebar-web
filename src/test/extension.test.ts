import * as assert from 'assert';
import * as vscode from 'vscode';
import { OpenCodeServer } from '../OpenCodeServer';
import { createMockContext, createMockServer, withEnvAsync } from './test-utils';

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
  });
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

  test('isRemoteEnvironment returns false in local test', () => {
    const server = new OpenCodeServer(context);
    assert.strictEqual(server.isRemoteEnvironment(), false);
  });

  test('isBinaryInstalled returns boolean without throwing', () => {
    const server = new OpenCodeServer(context);
    assert.strictEqual(typeof server.isBinaryInstalled(), 'boolean');
  });

  test('isConnectedToExisting returns false initially', () => {
    const server = new OpenCodeServer(context);
    assert.strictEqual(server.isConnectedToExisting, false);
  });

  test('webviewUrl getter does not throw when not running', () => {
    const server = new OpenCodeServer(context);
    assert.strictEqual(typeof server.webviewUrl, 'string');
  });
});

suite('DetectExistingServer', () => {
  let context: vscode.ExtensionContext;

  setup(() => {
    context = createMockContext();
  });

  test('detectExistingServer does not throw and returns result or null', async () => {
    const server = new OpenCodeServer(context);
    const result = await server.detectExistingServer();
    // Should not throw
    if (result === null) {
      assert.strictEqual(result, null);
    } else {
      assert.ok(result.url.startsWith('http://'), 'URL should be valid');
    }
  });

  test('detectExistingServer with unused port env var does not throw', async () => {
    const server = new OpenCodeServer(context);
    await withEnvAsync(
      { OPENCODE_PORT: '19999' },
      async () => server.detectExistingServer()
    );
    // Should not throw regardless of what's found
  });

  test('detects server via OPENCODE_URL env var', async () => {
    const mockSrv = await createMockServer(18791, {});
    try {
      const server = new OpenCodeServer(context);
      const result = await withEnvAsync(
        { OPENCODE_URL: 'http://127.0.0.1:18791' },
        async () => server.detectExistingServer()
      );
      assert.ok(result !== null, 'Should detect the mock server via OPENCODE_URL');
      assert.strictEqual(result!.url, 'http://127.0.0.1:18791');
    } finally {
      mockSrv.close();
    }
  });

  test('detects server via OPENCODE_PORT env var', async () => {
    const mockSrv = await createMockServer(18792, {});
    try {
      const server = new OpenCodeServer(context);
      const result = await withEnvAsync(
        { OPENCODE_PORT: '18792' },
        async () => server.detectExistingServer()
      );
      assert.ok(result !== null, 'Should detect the mock server via OPENCODE_PORT');
    } finally {
      mockSrv.close();
    }
  });
});

suite('Remote environment tests', () => {
  let context: vscode.ExtensionContext;

  setup(() => {
    context = createMockContext();
  });

  test('resolveWebviewUrl uses asExternalUri in remote environment', async () => {
    const server = new OpenCodeServer(context);
    const env = vscode.env as any;
    const originalRemoteName = env.remoteName;
    const originalAsExternalUri = env.asExternalUri;
    env.remoteName = 'ssh-remote';
    env.asExternalUri = async (uri: vscode.Uri) => {
      return vscode.Uri.parse(`https://remote-host${uri.path}`);
    };

    try {
      server['_proxyPort'] = 12345;
      server['_webviewUrl'] = '';
      await server['resolveWebviewUrl']();
      assert.strictEqual(server.webviewUrl, 'https://remote-host/');
    } finally {
      env.remoteName = originalRemoteName;
      env.asExternalUri = originalAsExternalUri;
    }
  });

  test('resolveWebviewUrl falls back to local proxy URL when asExternalUri fails', async () => {
    const server = new OpenCodeServer(context);
    const env = vscode.env as any;
    const originalRemoteName = env.remoteName;
    const originalAsExternalUri = env.asExternalUri;
    env.remoteName = 'ssh-remote';
    env.asExternalUri = async () => {
      throw new Error('unable to resolve');
    };

    try {
      server['_proxyPort'] = 54321;
      server['_webviewUrl'] = '';
      await server['resolveWebviewUrl']();
      assert.strictEqual(server.webviewUrl, 'http://127.0.0.1:54321');
    } finally {
      env.remoteName = originalRemoteName;
      env.asExternalUri = originalAsExternalUri;
    }
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
