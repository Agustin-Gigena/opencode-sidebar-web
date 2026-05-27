import { OpenCodeServer } from './OpenCodeServer';

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

export interface ContextOptions {
  filePath: string;
  lines: string;
  code: string;
}

export interface ActiveContextOptions {
  filePath: string;
  language: string;
  workspaceFolder: string;
}

export class OpenCodeAPI {
  private _password: string | undefined;

  constructor(private _server: OpenCodeServer) {
    this._password = process.env.OPENCODE_SERVER_PASSWORD;
  }

  private get baseUrl(): string {
    return this._server.serverUrl;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this._password) {
      headers['Authorization'] = `Basic ${Buffer.from(
        `opencode:${this._password}`
      ).toString('base64')}`;
    }
    return headers;
  }

  private assertServerRunning(): void {
    if (!this._server.isRunning) {
      throw new ServerNotRunningError();
    }
  }

  private async handleResponse(response: Response, context: string): Promise<any> {
    if (response.status === 401) {
      throw new AuthError(`Authentication failed for ${context}`);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `OpenCode API error (${context}): ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`
      );
    }
    return response.json();
  }

  async complete(code: string, systemPrompt: string): Promise<string> {
    this.assertServerRunning();

    const response = await fetch(`${this.baseUrl}/zen/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: 'default',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: code },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    }).catch((err) => {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new ServerNotRunningError(
          `Cannot reach OpenCode server at ${this.baseUrl} — ${err.message}`
        );
      }
      throw err;
    });

    const data = await this.handleResponse(response, 'complete');
    return data.choices?.[0]?.message?.content || '';
  }

  async setContext(options: ContextOptions): Promise<void> {
    this.assertServerRunning();

    const response = await fetch(`${this.baseUrl}/api/session/context`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(options),
      signal: AbortSignal.timeout(10000),
    }).catch((err) => {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new ServerNotRunningError(
          `Cannot reach OpenCode server at ${this.baseUrl} — ${err.message}`
        );
      }
      throw err;
    });

    await this.handleResponse(response, 'setContext');
  }

  async setActiveContext(options: ActiveContextOptions): Promise<void> {
    this.assertServerRunning();

    const response = await fetch(`${this.baseUrl}/api/session/active-context`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(options),
      signal: AbortSignal.timeout(10000),
    }).catch((err) => {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new ServerNotRunningError(
          `Cannot reach OpenCode server at ${this.baseUrl} — ${err.message}`
        );
      }
      throw err;
    });

    await this.handleResponse(response, 'setActiveContext');
  }

  static fromServer(server: OpenCodeServer): OpenCodeAPI {
    return new OpenCodeAPI(server);
  }
}
