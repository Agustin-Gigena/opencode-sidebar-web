import { execSync } from 'child_process';
import { PlatformManager } from './PlatformManager.js';

function hasAvx2(): boolean {
  try {
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

export class WindowsPlatformManager implements PlatformManager {
  private cpu: string;
  private _avx2: boolean;

  constructor(cpu: string, avx2?: boolean) {
    this.cpu = cpu;
    this._avx2 = avx2 ?? hasAvx2();
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
