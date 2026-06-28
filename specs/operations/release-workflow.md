# Release Workflow

## CI/CD

- **GitHub Actions** workflows in `.github/workflows/changelog.yml` and `.github/workflows/release.yml`.
- `changelog.yml` runs on every push to `production`: generates changelog via AI (`scripts/release-ai.py`) and optionally triggers a release.
- `release.yml` is triggered by `workflow_call` from `changelog.yml` or manually via `workflow_dispatch` with a version input.
- Build and release automation via `@vscode/vsce`.
- Version managed in `package.json` (set by `release.yml` via `npm version`).

## Changelog Automation

See [changelog-automation.md](changelog-automation.md) for detailed design.

## Branch Strategy

- **Never push directly to `production`.** All changes enter via a pull request.
- Branch naming: `{base}_{feature}` (e.g. `development_changelog-ai`).
- `{base}` is semantic (e.g. `development`), not an actual remote branch. Feature branches branch off `production` and PR into `production`.
- PR merge triggers `changelog.yml` automatically.

## Release Process

1. PR merge to `production` triggers `changelog.yml`.
2. `git-cliff` generates raw entries from conventional commits.
3. `scripts/release-ai.py` calls opencode CLI to refine entries, decide SemVer version, and write bilingual changelogs.
4. If a new version is detected, `release.yml` is triggered.
5. CI checks out the repo and sets up Node.js 22.
6. `npm ci` installs dependencies.
7. `npm run compile` verifies TypeScript compilation.
8. `npm run lint` verifies code quality.
9. `npm install opencode-ai` installs the server binary for integration tests.
10. `xvfb-run -a npm test` runs all tests with a virtual framebuffer.
11. `npm version` updates `package.json` to the target version.
12. `npm run esbuild` builds the production bundle.
13. `npx vsce package` generates the `.vsix` file.
14. `gh release create` creates a GitHub Release with auto-generated notes and attaches the `.vsix`.
15. A summary is printed to the GitHub Actions step summary.

## Pre-release Checklist

- [ ] `npm run pretest` passes (compile + lint).
- [ ] `npm test` passes.
- [ ] `npm run esbuild` produces a valid bundle.
- [ ] Manual smoke test: open panel, verify server starts, UI loads.

## Configuration

- `@vscode/vsce` packaging via `package.json` metadata (publisher, name, version, icon).
- `.vscodeignore` controls what is excluded from the VSIX.
- Extension icon: `media/icon.png`.
