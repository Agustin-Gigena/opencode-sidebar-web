import * as assert from 'assert';
import { LinuxPlatformManager } from '../platform/LinuxPlatformManager';
import { MacOSPlatformManager } from '../platform/MacOSPlatformManager';
import { WindowsPlatformManager } from '../platform/WindowsPlatformManager';

suite('PlatformManager', () => {
  test('LinuxPlatformManager provides correct values (AVX2)', () => {
    const manager = new LinuxPlatformManager('x64', true);
    assert.strictEqual(manager.getBinaryName(), 'opencode');
    assert.strictEqual(manager.getAssetName('v1.0.0'), 'opencode-linux-x64.tar.gz');
    assert.strictEqual(manager.getArchiveFormat(), 'tar.gz');
  });

  test('LinuxPlatformManager provides correct values (baseline)', () => {
    const manager = new LinuxPlatformManager('x64', false);
    assert.strictEqual(manager.getAssetName('v1.0.0'), 'opencode-linux-x64-baseline.tar.gz');
  });

  test('MacOSPlatformManager provides correct values', () => {
    const manager = new MacOSPlatformManager('arm64');
    assert.strictEqual(manager.getBinaryName(), 'opencode');
    assert.strictEqual(manager.getAssetName('v1.0.0'), 'opencode-darwin-arm64.zip');
    assert.strictEqual(manager.getArchiveFormat(), 'zip');
  });

  test('WindowsPlatformManager provides correct values', () => {
    const manager = new WindowsPlatformManager('x64', false);
    assert.strictEqual(manager.getBinaryName(), 'opencode.exe');
    assert.strictEqual(manager.getAssetName('v1.0.0'), 'opencode-windows-x64-baseline.zip');
    assert.strictEqual(manager.getArchiveFormat(), 'zip');
  });
});
