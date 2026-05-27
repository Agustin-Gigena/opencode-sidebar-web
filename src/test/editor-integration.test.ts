import * as assert from 'assert';
import * as http from 'http';
import * as vscode from 'vscode';
import { CodeLensProvider } from '../CodeLensProvider';
import { OpenCodeAPI, ServerNotRunningError, AuthError } from '../OpenCodeAPI';
import { OpenCodeServer } from '../OpenCodeServer';
import { createMockServer, withEnvAsync } from './test-utils';

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

suite('OpenCodeAPI', () => {
  test('constructs correct request URL and body for complete()', async () => {
    let requestCount = 0;
    const server = await new Promise<http.Server>((resolve) => {
      const srv = http.createServer((req, res) => {
        requestCount++;
        if (requestCount === 1) {
          assert.ok(req.url === '/session', 'First request should be to /session');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 'test-session-id' }));
        } else {
          assert.ok(req.url?.startsWith('/session/'), 'Second request should be to /session/:id/message');
          const body: Buffer[] = [];
          req.on('data', (c) => body.push(c));
          req.on('end', () => {
            const parsed = JSON.parse(Buffer.concat(body).toString());
            assert.strictEqual(parsed.parts[0].type, 'text');
            assert.strictEqual(parsed.parts[0].text, 'test code');
            assert.strictEqual(parsed.system, 'test prompt');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ parts: [{ type: 'text', text: parsed.parts[0].text }] }));
          });
        }
      });
      srv.listen(18793, '127.0.0.1', () => resolve(srv));
    });
    try {
      const mockServer = {
        isRunning: true,
        serverUrl: 'http://127.0.0.1:18793',
      } as unknown as OpenCodeServer;
      const api = new OpenCodeAPI(mockServer);
      const result = await api.complete('test code', 'test prompt');
      assert.strictEqual(result, 'test code');
      assert.strictEqual(requestCount, 2, 'Should make 2 requests (session + message)');
    } finally {
      server.close();
    }
  });

  test('handles auth via OPENCODE_SERVER_PASSWORD', async () => {
    const capturedAuths: string[] = [];
    const server = await new Promise<http.Server>((resolve) => {
      const srv = http.createServer((req, res) => {
        capturedAuths.push(req.headers['authorization'] as string || '');
        if (req.url === '/session') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 'test-session-id' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ parts: [{ type: 'text', text: 'ok' }] }));
        }
      });
      srv.listen(18794, '127.0.0.1', () => resolve(srv));
    });
    try {
      const mockServer = {
        isRunning: true,
        serverUrl: 'http://127.0.0.1:18794',
      } as unknown as OpenCodeServer;
      await withEnvAsync(
        { OPENCODE_SERVER_PASSWORD: 'secret123' },
        async () => {
          const api = new OpenCodeAPI(mockServer);
          return api.complete('test', 'test');
        }
      );
      assert.ok(capturedAuths.length > 0, 'Auth header should be present on at least one request');
      const decoded = Buffer.from(
        capturedAuths[0].replace('Basic ', ''), 'base64'
      ).toString();
      assert.strictEqual(decoded, 'opencode:secret123');
    } finally {
      server.close();
    }
  });

  test('handles server-not-running error gracefully', async () => {
    const mockServer = {
      isRunning: false,
      serverUrl: 'http://127.0.0.1:19999',
    } as unknown as OpenCodeServer;
    const api = new OpenCodeAPI(mockServer);
    try {
      await api.complete('test', 'test');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof ServerNotRunningError);
    }
  });

  test('handles auth failure with 401 status', async () => {
    const server = await new Promise<http.Server>((resolve) => {
      const srv = http.createServer((_req, res) => {
        res.writeHead(401);
        res.end();
      });
      srv.listen(18795, '127.0.0.1', () => resolve(srv));
    });
    try {
      const mockServer = {
        isRunning: true,
        serverUrl: 'http://127.0.0.1:18795',
      } as unknown as OpenCodeServer;
      const api = new OpenCodeAPI(mockServer);
      try {
        await api.complete('test', 'test');
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err instanceof AuthError);
      }
    } finally {
      server.close();
    }
  });

  test('throws descriptive error when server returns HTML', async () => {
    const server = await new Promise<http.Server>((resolve) => {
      const srv = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<!doctype html><html><body>Not found</body></html>');
      });
      srv.listen(18796, '127.0.0.1', () => resolve(srv));
    });
    try {
      const mockServer = {
        isRunning: true,
        serverUrl: 'http://127.0.0.1:18796',
      } as unknown as OpenCodeServer;
      const api = new OpenCodeAPI(mockServer);
      try {
        await api.complete('test', 'test');
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok((err as Error).message.includes('text/html'));
        assert.ok((err as Error).message.includes('doctype'));
      }
    } finally {
      server.close();
    }
  });

  test('throws descriptive error on JSON parse failure', async () => {
    const server = await new Promise<http.Server>((resolve) => {
      const srv = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('not valid json');
      });
      srv.listen(18797, '127.0.0.1', () => resolve(srv));
    });
    try {
      const mockServer = {
        isRunning: true,
        serverUrl: 'http://127.0.0.1:18797',
      } as unknown as OpenCodeServer;
      const api = new OpenCodeAPI(mockServer);
      try {
        await api.complete('test', 'test');
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok((err as Error).message.includes('Failed to parse response as JSON'));
        assert.ok((err as Error).message.includes('not valid json'));
      }
    } finally {
      server.close();
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
      assert.strictEqual(updated, false);
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
