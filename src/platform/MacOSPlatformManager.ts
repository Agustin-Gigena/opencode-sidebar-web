import * as fs from 'fs';
import { execSync } from 'child_process';
import { PlatformManager } from './PlatformManager.js';

function hasAvx2(): boolean {
  try {
    const out = execSync('sysctl hw.optional.avx2_0', {
      encoding: 'utf8',
      timeout: 3000,
    });
    return out.includes('1');
  } catch {
    return false;
  }
}

export class MacOSPlatformManager implements PlatformManager {
  private cpu: string;
  private _avx2: boolean;

  constructor(cpu: string) {
    this.cpu = cpu;
    this._avx2 = hasAvx2();
  }

  getBinaryName(): string {
    return 'opencode';
  }

  getAssetName(_tag: string): string {
    if (this.cpu === 'arm64') {
      return 'opencode-darwin-arm64.zip';
    }
    return this._avx2 ? 'opencode-darwin-x64.zip' : 'opencode-darwin-x64-baseline.zip';
  }

  getArchiveFormat(): 'zip' | 'tar.gz' {
    return 'zip';
  }

  async extractBinary(archiveBuffer: ArrayBuffer, targetDir: string): Promise<void> {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(Buffer.from(archiveBuffer));
    zip.extractAllTo(targetDir, true);
  }

  async makeExecutable(binaryPath: string): Promise<void> {
    await fs.promises.chmod(binaryPath, 0o755);
  }
}
