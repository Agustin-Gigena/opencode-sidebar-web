# Release Workflow

## CI/CD

- **GitHub Actions** workflow in `.github/workflows/release.yml`.
- Triggered manually via `workflow_dispatch` with a version input.
- Build and release automation via `@vscode/vsce`.
- Version managed in `package.json`.

## Release Process

1. User triggers the "Release VSIX" workflow with a version string (e.g. `1.0.0`).
2. CI checks out the repo and sets up Node.js 22.
3. `npm ci` installs dependencies.
4. `npm run compile` verifies TypeScript compilation.
5. `npm run lint` verifies code quality.
6. `npm install opencode-ai` installs the server binary for integration tests.
7. `xvfb-run -a npm test` runs all tests with a virtual framebuffer.
8. `npm version` updates `package.json` to the target version.
9. `npm run esbuild` builds the production bundle.
10. `npx vsce package` generates the `.vsix` file.
11. `gh release create` creates a GitHub Release with auto-generated notes and attaches the `.vsix`.
12. A summary is printed to the GitHub Actions step summary.

## Pre-release Checklist

- [ ] `npm run pretest` passes (compile + lint).
- [ ] `npm test` passes.
- [ ] `npm run esbuild` produces a valid bundle.
- [ ] Manual smoke test: open panel, verify server starts, UI loads.
- [ ] CHANGELOG.md is updated for the new version.

## Configuration

- `@vscode/vsce` packaging via `package.json` metadata (publisher, name, version, icon).
- `.vscodeignore` controls what is excluded from the VSIX.
- Extension icon: `media/icon.png`.
