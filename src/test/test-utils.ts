import * as http from 'http';
import * as vscode from 'vscode';
import * as path from 'path';

export function createMockContext(): vscode.ExtensionContext {
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

export function createMockServer(
  port: number,
  responseHeaders: Record<string, string>,
  responseBody?: string
): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/global/health') {
        res.writeHead(200, { 'Content-Type': 'application/json', ...responseHeaders });
        res.end(responseBody || JSON.stringify({ healthy: true, version: 'test' }));
      } else {
        const body: Buffer[] = [];
        req.on('data', (c) => body.push(c));
        req.on('end', () => {
          res.writeHead(200, { ...responseHeaders });
          res.end(Buffer.concat(body));
        });
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

export function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
}

export async function withEnvAsync<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
}
