# Changelog Automation

## Overview

AI-powered changelog generation and release workflow. On every push to `production`, a GitHub Actions workflow generates raw changelog entries via `git-cliff`, then an AI agent (opencode CLI) refines the entries by analyzing full commit content, compresses related commits, decides the next SemVer version, and produces bilingual changelogs (EN + ES).

## Flow

```
Push to production
  │
  ├─ 1. git-cliff --unreleased → raw entries (_raw.md)
  │
  ├─ 2. release-ai.py
  │      ├─ Reads _raw.md + full commit log (lasttag..HEAD)
  │      ├─ Calls opencode run → AI prompt
  │      │    └─ Returns: version, en_entries, es_entries, is_release
  │      ├─ Writes CHANGELOG.md + CHANGELOG.es.md
  │      ├─ Creates & pushes git tag vX.Y.Z (if release)
  │      └─ Sets NEW_VERSION env var
  │
  ├─ 3. Auto-commit changelogs [skip ci]
  │
  └─ 4. If NEW_VERSION → trigger release.yml
```

## AI Version Decision

SemVer based on full commit content (title + body + footers + diff stat):

| Criteria | Bump |
|----------|------|
| BREAKING CHANGE footer or `!` after type | major |
| At least one `feat` | minor |
| Only `fix`, `refactor`, `docs`, `perf`, `test`, `chore`, `ci` | patch |

## Commit Compression

The AI groups multiple commits that belong to the same feature or fix into a single changelog entry. For example, `fix: handle edge case`, `fix: add null check`, `fix: test` → one entry: "Fix null pointer when loading config".

## Script: `scripts/release-ai.py`

### Responsibilities

1. Collect context: last tag (`git describe --tags --abbrev=0`), full commit log (`git log lasttag..HEAD --format=full`), git-cliff raw output
2. Build structured prompt
3. Execute `opencode run [prompt]`
4. Parse JSON response
5. Write CHANGELOG.md and CHANGELOG.es.md (prepend new version section, keep older entries)
6. Create and push git tag (`git tag vX.Y.Z && git push origin vX.Y.Z`)
7. Export `NEW_VERSION` to GITHUB_ENV

### Fallback

If `opencode run` fails or returns invalid JSON:
- Fall back to git-cliff output only (no AI refinement)
- Write entries under `## [Unreleased]` (no version bump)
- Do NOT create tag or trigger release
- Log warning to workflow console

### Dependencies

- `opencode` CLI (installed via `npm install -g opencode-ai` in the workflow)
- `git-cliff` (installed via `taiki-e/install-action`)
- Python 3 with `json`, `subprocess`, `os`, `re`, `sys`

## Workflow: `.github/workflows/changelog.yml`

### Trigger

- `push` to `production` branch
- `paths-ignore`: none (process all pushes)
- Exclude `github-actions[bot]` to avoid loops

### Steps

1. `actions/checkout@v4` with `fetch-depth: 0`
2. Install `git-cliff`
3. Install `opencode` CLI: `npm install -g opencode-ai`
4. Generate raw entries: `git-cliff --unreleased --config cliff.toml --output _raw.md`
5. Run AI release: `python3 scripts/release-ai.py`
   - Env: `OPENCODE_API_KEY`, `GITHUB_TOKEN`
6. Auto-commit changelogs (if changed)
7. If `NEW_VERSION != ''`: trigger `release.yml` via `gh workflow run`

### Secrets Required

- `OPENCODE_API_KEY` — API key for opencode CLI

## Removed Scripts

- `scripts/detect-version.py` — replaced by AI version decision
- `scripts/merge-changelog.py` — replaced by AI-powered write

## Changelog Format

```markdown
## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD

### Added
- Feature description (user-facing)

### Changed
- Refactor or improvement description

### Fixed
- Bug fix description

### Removed
- Deprecated feature removal
```

Bilingual: `CHANGELOG.md` (EN), `CHANGELOG.es.md` (ES) with identical structure but translated section headers.

## Release Workflow

`release.yml` remains unchanged. It is triggered by `workflow_call` from `changelog.yml` via `gh workflow run`.
