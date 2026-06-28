import * as vscode from 'vscode';
import { OpenCodeServer } from './OpenCodeServer.js';

export class ServerNotRunningError extends Error {
  constructor(message?: string) {
    super(message || 'OpenCode server is not running');
    this.name = 'ServerNotRunningError';
  }
}

export class AuthError extends Error {
  constructor(message?: string) {
    super(message || 'Authentication failed');
    this.name = 'AuthError';
  }
}

export class OpenCodeAPI {
  private _server: OpenCodeServer;
  private _sessionId: string | undefined;

  constructor(server: OpenCodeServer) {
    this._server = server;
  }

  private get client(): any {
    const client = this._server.client;
    if (!client) {
      throw new ServerNotRunningError('OpenCode client not initialized');
    }
    return client;
  }

  private async ensureSession(): Promise<string> {
    if (this._sessionId) { return this._sessionId; }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const session = await this.client.session.create({
      directory: workspaceFolder,
      title: 'OpenCode Sidebar',
    });
    const sessionId = session.data?.id;
    if (!sessionId) {
      throw new Error('Failed to create session');
    }
    this._sessionId = sessionId;
    return sessionId;
  }

  async complete(code: string, systemPrompt: string): Promise<string> {
    const sessionId = await this.ensureSession();

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const response = await this.client.session.prompt(sessionId, {
      directory: workspaceFolder,
      parts: [{ type: 'text', text: code }],
      system: systemPrompt,
    });

    return (response.data.parts ?? [])
      .map((p: { text?: string }) => p.text ?? '')
      .filter(Boolean)
      .join('\n');
  }

  static fromServer(server: OpenCodeServer): OpenCodeAPI {
    return new OpenCodeAPI(server);
  }
}