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

export class OpenCodeAPI {
  private _password: string | undefined;
  private _sessionId: string | undefined;

  constructor(private _server: OpenCodeServer) {
    this._password = process.env.OPENCODE_SERVER_PASSWORD;
  }

  private get baseUrl(): string {
    return this._server.serverUrl;
  }

  private async ensureSession(): Promise<string> {
    if (this._sessionId) { return this._sessionId; }

    this.assertServerRunning();

    const response = await fetch(`${this.baseUrl}/session`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ title: 'OpenCode Sidebar' }),
      signal: AbortSignal.timeout(10000),
    });

    const data: any = await this.handleResponse(response, 'session.create');
    this._sessionId = data.id as string;
    return this._sessionId;
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

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Server returned HTML instead of JSON for "${context}" — the endpoint may not exist. Response: ${body.slice(0, 200)}`
      );
    }

    try {
      return await response.json();
    } catch (parseErr) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Failed to parse response as JSON for "${context}". Content-Type: "${contentType}". Body: ${body.slice(0, 200)}`
      );
    }
  }

  async complete(code: string, systemPrompt: string): Promise<string> {
    const sessionId = await this.ensureSession();

    const response = await fetch(`${this.baseUrl}/session/${sessionId}/message`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        parts: [{ type: 'text', text: code }],
        system: systemPrompt,
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
    return data.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join('\n') || '';
  }

  static fromServer(server: OpenCodeServer): OpenCodeAPI {
    return new OpenCodeAPI(server);
  }
}
