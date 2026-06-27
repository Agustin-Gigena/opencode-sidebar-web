import { platform, arch } from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface PlatformManager {
  getBinaryName(): string;
  getAssetName(tag: string): string;
  getArchiveFormat(): 'zip' | 'tar.gz';
  extractBinary(archiveBuffer: ArrayBuffer, targetDir: string): Promise<void>;
  makeExecutable(binaryPath: string): Promise<void>;
}

function hasAvx2(): boolean {
  const plat = platform();
  if (plat === 'linux') {
    try {
      const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
      return cpuinfo.includes('avx2');
    } catch {
      return false;
    }
  }
  if (plat === 'darwin') {
    try {
      const { execSync } = require('child_process');
      const out = execSync('sysctl hw.optional.avx2_0', {
        encoding: 'utf8',
        timeout: 3000,
      });
      return out.includes('1');
    } catch {
      return false;
    }
  }
  if (plat === 'win32') {
    try {
      const { execSync } = require('child_process');
      const script = `
        $method = [Type]::GetTypeFromProgID('Kernel32');
        $result = [Kernel32]::IsProcessorFeaturePresent(40);
        if ($result) { Write-Output '1' } else { Write-Output '0' }
      `;
      const out = execSync(
        `powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`,
        { encoding: 'utf8', timeout: 5000 }
      );
      return out.trim() === '1';
    } catch {
      try {
        const { execSync } = require('child_process');
        const script = `
          [System.Runtime.InteropServices.Marshal]::SizeOf(
            [System.Runtime.InteropServices.Marshal]::GetExceptionPointers()
          )
        `;
        const out = execSync(
          `powershell -NoProfile -Command "try { Add-Type -TypeDefinition 'public class CPU { public static bool IsAvx2() { try { return System.Runtime.Intrinsics.X86.Avx2.IsSupported; } catch { return false; } } }'; [CPU]::IsAvx2() } catch { Write-Output 'false' }"`,
          { encoding: 'utf8', timeout: 5000 }
        );
        return out.trim().toLowerCase() === 'true';
      } catch {
        return false;
      }
    }
  }
  return false;
}

function isMusl(): boolean {
  try {
    if (fs.existsSync('/etc/alpine-release')) {
      return true;
    }
  } catch {
    /* ignore */
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

class LinuxPlatformManager implements PlatformManager {
  private cpu: string;
  private _avx2: boolean;
  private _musl: boolean;

  constructor(cpu: string) {
    this.cpu = cpu;
    this._avx2 = hasAvx2();
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

class MacOSPlatformManager implements PlatformManager {
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

class WindowsPlatformManager implements PlatformManager {
  private cpu: string;
  private _avx2: boolean;

  constructor(cpu: string) {
    this.cpu = cpu;
    this._avx2 = hasAvx2();
  }

  getBinaryName(): string {
    return 'opencode.exe';
  }

  getAssetName(_tag: string): string {
    const base = this._avx2 ? 'opencode-windows-x64' : 'opencode-windows-x64-baseline';
    return `${base}.zip`;
  }

  getArchiveFormat(): 'zip' | 'tar.gz' {
    return 'zip';
  }

  async extractBinary(archiveBuffer: ArrayBuffer, targetDir: string): Promise<void> {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(Buffer.from(archiveBuffer));
    zip.extractAllTo(targetDir, true);
  }

  async makeExecutable(_binaryPath: string): Promise<void> {
  }
}

export function createPlatformManager(): PlatformManager {
  const plat = platform();
  const cpu = arch();

  switch (plat) {
    case 'linux':
      return new LinuxPlatformManager(cpu);
    case 'darwin':
      return new MacOSPlatformManager(cpu);
    case 'win32':
      return new WindowsPlatformManager(cpu);
    default:
      throw new Error(
        `Unsupported platform: ${plat} (${cpu}). ` +
        `OpenCode binary is available for Linux, macOS, and Windows.`
      );
  }
}
