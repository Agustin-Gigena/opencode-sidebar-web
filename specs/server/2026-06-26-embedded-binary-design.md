# Embedded Binary via GitHub Releases

**Status**: Design (approved)
**Date**: 2026-06-26

Replaces npm-based binary management (`opencode-ai` package) with on-demand download from GitHub Releases, cached by version under `globalStorageUri`.

## Motivation

- Remove dependency on `opencode-ai` npm package and its postinstall script.
- Eliminate npm install step (slow, requires network + npm configured).
- Eliminate complex binary search logic (`findBinaryPath()`, platform-specific npm module probing).
- Eliminate parallel process detection (`detectExistingServer()`).
- User controls which opencode version to use via a setting.
- Binary is cached by version and only downloaded when the version changes.

## Removed Components

| Component | Reason |
|---|---|
| `installBinary()` | No more npm install |
| `findBinaryPath()` | No more search PATH/npm_modules |
| `detectExistingServer()` | No parallel execution detection |
| `ensureBundledBinary()` | No more copy from node_modules |
| Setting `devcontainerMode` | Irrelevant (binary always runs locally) |
| Setting `autoInstallInDevcontainer` | Irrelevant |
| Command `opencode-sidebar-web.installBinary` | No more explicit install step |
| Dependency `opencode-ai` in `package.json` | Replaced by `adm-zip` + `modern-tar` |

## New Setting

| ID | Type | Default | Description |
|---|---|---|---|
| `opencode-sidebar-web.opencodeVersion` | `string` | `"latest"` | OpenCode version to use (e.g. `"1.17.11"`, `"latest"`) |

## Architecture

```
extension.ts
  └── OpenCodeServer.start()
       ├── createPlatformManager()           ← new
       ├── getBinaryPath(version, cacheDir)   ← new
       │    ├── cacheDir exists + binary OK → return path
       │    └── cacheDir missing/binary bad  → downloadIfNeeded()
       ├── spawn(binaryPath, args)
       └── Proxy / health check (unchanged)
```

### New files

| File | Purpose |
|---|---|
| `src/platform/PlatformManager.ts` | Interface + factory |
| `src/platform/LinuxPlatformManager.ts` | Linux implementation |
| `src/platform/MacOSPlatformManager.ts` | macOS implementation |
| `src/platform/WindowsPlatformManager.ts` | Windows implementation |
| `src/GitHubAPI.ts` | GitHub Releases API client |

## PlatformManager Interface

```typescript
interface PlatformManager {
  /** Binary filename: "opencode" | "opencode.exe" */
  getBinaryName(): string;

  /** GitHub Release asset name for the given tag */
  getAssetName(tag: string): string;

  /** Archive format: "zip" | "tar.gz" */
  getArchiveFormat(): 'zip' | 'tar.gz';

  /** Extract the binary from archive buffer into targetDir */
  extractBinary(archiveBuffer: ArrayBuffer, targetDir: string): Promise<void>;

  /** Make binary executable (chmod +x on POSIX, no-op on Windows) */
  makeExecutable(binaryPath: string): Promise<void>;
}

function createPlatformManager(): PlatformManager;
```

### Asset names by platform

| Platform | arch | Asset name | Format |
|---|---|---|---|
| `linux` | x64 | `opencode-linux-x64.tar.gz` | `.tar.gz` |
| `linux` | x64 (baseline) | `opencode-linux-x64-baseline.tar.gz` | `.tar.gz` |
| `linux` | arm64 | `opencode-linux-arm64.tar.gz` | `.tar.gz` |
| `darwin` | x64 | `opencode-darwin-x64.zip` | `.zip` |
| `darwin` | x64 (baseline) | `opencode-darwin-x64-baseline.zip` | `.zip` |
| `darwin` | arm64 | `opencode-darwin-arm64.zip` | `.zip` |
| `win32` | x64 | `opencode-windows-x64.zip` | `.zip` |
| `win32` | x64 (baseline) | `opencode-windows-x64-baseline.zip` | `.zip` |

Baseline detection (no AVX2) matches the logic in the current `opencode-ai` postinstall script (check `/proc/cpuinfo` on Linux, `sysctl` on macOS, `IsProcessorFeaturePresent` on Windows).

On Linux, musl detection (check `/etc/alpine-release` or `ldd --version`) selects `-musl` variants.

### Extraction

- `.zip`: use `adm-zip` — `new AdmZip(buffer).extractEntryTo(name, targetDir, false, true)`
- `.tar.gz`: use `modern-tar` + Node.js `zlib` — `pipeline(response.body, createGunzip(), unpackTar(targetDir))`

## Download Flow

```
start()
  ↓
readVersionFromConfig()  ← "latest" or "1.17.11"
  ↓
cacheDir = globalStorageUri/opencode-bin/<version>/
  ↓
binaryExists(cacheDir + binaryName) && verifyBinary(binaryPath)?
  ├── yes → return binaryPath
  └── no  → download(version, platformManager)
              ↓
            resolveVersion(version)
              ├── "latest" → GET /repos/anomalyco/opencode/releases/latest → tag_name
              └── "X.Y.Z"  → GET /repos/anomalyco/opencode/releases/tags/vX.Y.Z
              ↓
            getAsset(tag, platformManager.getAssetName(tag))
              → download_url + sha256 digest from API
              ↓
            download(url, onProgress)
              → ArrayBuffer
              ↓
            platformManager.extractBinary(buffer, cacheDir)
              ↓
            platformManager.makeExecutable(binaryPath)
              ↓
            verify with --version
              ↓
            return binaryPath
```

### GitHub API

- Base: `https://api.github.com/repos/anomalyco/opencode`
- Rate limit: unauthenticated requests limited to 60/hr. Extension should handle 403 with user-facing message.
- Download URLs are `browser_download_url` from the release asset payload.

## Testing

### Updated tests

- `src/test/extension.test.ts`: remove tests for `findBinaryPath()`, `detectExistingServer()`, `installBinary()`, `ensureBundledBinary()`

### New tests

- `PlatformManager` unit tests: each implementation returns correct `getBinaryName()`, `getAssetName()`, `getArchiveFormat()`
- `GitHubAPI` tests: mock fetch to simulate release lookup, asset listing, and download with progress
- `OpenCodeServer.start()` integration: mock `PlatformManager` + `GitHubAPI` to verify the new start flow

## Related Specs

- [server-management.md](server-management.md) (will be updated to reflect new flow)
- [server-detection.md](server-detection.md) (obsoleted)
- [remote-environments.md](remote-environments.md) (obsoleted)
