# Agent Guidelines

## Spec-First Workflow

- Read `specs/README.md` before any feature work.
- Assume specs describe intent, not implementation.
- Verify reality in the codebase before claiming something exists.
- Implement to spec patterns and data shapes; update specs only when asked.
- When writing specs, **NEVER** follow Test Driven Development practices. Write the spec first and stop.
- For programming tasks, always load Test Driven Development skill.

## Quality Gates

- Follow linting rules: `npm run lint`.
- TypeScript compilation: `npm run compile` (tsc).
- Build: `npm run esbuild`.
- Run tests: `npm test`.
- Coverage gate: aim for meaningful test coverage on new code.

## Build and Run

- Compile TypeScript: `npm run compile`
- Build extension: `npm run esbuild`
- Watch mode: `npm run watch`
- Lint: `npm run lint`
- Run extension in VS Code: Press F5 with the project open.

## Tooling Expectations

- Node.js version: see `.devcontainer` or `engines` in package.json.
- VS Code API: `@types/vscode` v1.106.0+.
- ESLint + typescript-eslint for linting.
- esbuild for bundling.

## Branch Strategy

- **Never push directly to `production`.** All changes must go through a pull request.
- Branch naming: `{base_branch}_{feature}` — e.g. `development_changelog-ai`, `development_fix-auth`
- Base branch is typically `development`. Feature branches branch off `development` and PR into `production`.
- The `changelog.yml` workflow triggers on push to `production`, which happens automatically when a PR merges.

## Implementation Guidance

- Keep the webview panel implementation clean and well-structured.
- Follow existing patterns in `src/` for extension commands, server management, and webview handling.
- When adding new settings, register them in `contributes.configuration` in package.json.
- Ensure backward compatibility for existing configuration options.
