import * as fs from 'fs';
import { PlatformManager } from './PlatformManager.js';

function isMusl(): boolean {
  try {
    if (fs.existsSync('/etc/alpine-release')) {
      return true;
    }
  } catch {
  }
  try {
    const { execSync } = require('child_process');
    const out = execSync('ldd --version 2>&1 || true', {
      encoding: 'utf8',
      timeout: 3000,
    });
    return out.toLowerCase().includes('musl');
  } catch {
    return false;
  }
}

export class LinuxPlatformManager implements PlatformManager {
  private cpu: string;
  private _avx2: boolean;
  private _musl: boolean;

  constructor(cpu: string, avx2: boolean) {
    this.cpu = cpu;
    this._avx2 = avx2;
    this._musl = isMusl();
  }

  getBinaryName(): string {
    return 'opencode';
  }

  getAssetName(_tag: string): string {
    let base: string;
    if (this.cpu === 'arm64') {
      base = 'opencode-linux-arm64';
    } else {
      base = this._avx2 ? 'opencode-linux-x64' : 'opencode-linux-x64-baseline';
    }
    if (this._musl) {
      base += '-musl';
    }
    return `${base}.tar.gz`;
  }

  getArchiveFormat(): 'zip' | 'tar.gz' {
    return 'tar.gz';
  }

  async extractBinary(archiveBuffer: ArrayBuffer, targetDir: string): Promise<void> {
    const { pipeline } = await import('stream/promises');
    const { createGunzip } = await import('zlib');
    const { unpackTar } = await import('modern-tar/fs');
    const { Readable } = await import('stream');
    await pipeline(
      Readable.from(Buffer.from(archiveBuffer)),
      createGunzip(),
      unpackTar(targetDir)
    );
  }

  async makeExecutable(binaryPath: string): Promise<void> {
    await fs.promises.chmod(binaryPath, 0o755);
  }
}
