import { platform, arch } from 'os';
import * as fs from 'fs';
import { LinuxPlatformManager } from './LinuxPlatformManager.js';
import { MacOSPlatformManager } from './MacOSPlatformManager.js';
import { WindowsPlatformManager } from './WindowsPlatformManager.js';

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

  return false;
}

export function createPlatformManager(): PlatformManager {
  const plat = platform();
  const cpu = arch();

  switch (plat) {
    case 'linux':
      return new LinuxPlatformManager(cpu, hasAvx2());
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
