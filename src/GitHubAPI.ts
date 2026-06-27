export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface ReleaseInfo {
  tag_name: string;
  assets: GitHubAsset[];
}

export class RateLimitError extends Error {
  constructor(rateLimitRemaining: string | null, resetTime: string | null) {
    const message = resetTime
      ? `GitHub API rate limit exceeded. Resets at ${new Date(parseInt(resetTime || '0', 10) * 1000).toISOString()}.`
      : 'GitHub API rate limit exceeded.';
    super(message);
    this.name = 'RateLimitError';
  }
}

export type ProgressCallback = (downloaded: number, total: number) => void;

export class GitHubAPI {
  private owner: string;
  private repo: string;
  private baseUrl: string;

  constructor(owner = 'anomalyco', repo = 'opencode') {
    this.owner = owner;
    this.repo = repo;
    this.baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  }

  async getRelease(version: string): Promise<ReleaseInfo> {
    const url = version === 'latest'
      ? `${this.baseUrl}/releases/latest`
      : `${this.baseUrl}/releases/tags/v${version.startsWith('v') ? version.slice(1) : version}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'opencode-sidebar-web',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 403) {
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const reset = response.headers.get('X-RateLimit-Reset');
      throw new RateLimitError(remaining, reset);
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch release info for "${version}": GitHub API returned ${response.status}`
      );
    }

    return response.json() as Promise<ReleaseInfo>;
  }

  getAsset(release: ReleaseInfo, assetName: string): GitHubAsset {
    const asset = release.assets.find((a) => a.name === assetName);
    if (!asset) {
      const available = release.assets.map((a) => a.name).join(', ');
      throw new Error(
        `Asset "${assetName}" not found in release ${release.tag_name}. Available assets: ${available}`
      );
    }
    return asset;
  }

  async download(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<ArrayBuffer> {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/octet-stream',
      },
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`
      );
    }

    const total = parseInt(response.headers.get('Content-Length') || '0', 10);
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const chunks: Uint8Array[] = [];
    let downloaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) { break; }
      chunks.push(value);
      downloaded += value.length;
      onProgress?.(downloaded, total);
    }

    const all = new Uint8Array(downloaded);
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }

    return all.buffer;
  }
}
