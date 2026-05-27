# Development and Testing

## Setup

- `npm install` — install dependencies (including `opencode-ai` for the server binary).
- `npm run compile` — TypeScript compilation (`tsc -p ./`).
- `npm run esbuild` — bundle `src/extension.ts` into `out/extension.js` for production.

## Linting

- `npm run lint` — ESLint with `typescript-eslint` on `src/`.

## Testing

- `npm test` — run VS Code extension tests via `@vscode/test-electron`.
- Test suites in `src/test/extension.test.ts`:
  - **Extension Test Suite**: verifies all 7 commands are registered.
  - **OpenCodeServer**: constructor, binary detection, remote env, state getters.
  - **DetectExistingServer**: env var detection (`OPENCODE_URL`, `OPENCODE_PORT`), mock HTTP server health checks.
  - **Start and stop server**: full start → health check → stop cycle (requires `opencode` binary).
- Test utilities in `src/test/test-utils.ts`:
  - `createMockContext()` — creates a minimal `vscode.ExtensionContext` for unit tests.
  - `createMockServer()` — creates a local HTTP server with `/global/health` endpoint for detection tests.
  - `withEnv()` / `withEnvAsync()` — temporarily set/restore environment variables.

## Test Configuration

- `.vscode-test.mjs` — VS Code test runner configuration.
- `--disable-extensions` flag for clean test runs.
- Tests require `opencode` binary in PATH or installed via `npm install opencode-ai`.

## Quality Gates

- Code must compile without errors (`npm run compile`).
- Lint must pass (`npm run lint`).
- Tests must pass (`npm test`).
- esbuild must bundle successfully (`npm run esbuild`).
- New features should include tests where practical.
- Coverage gate: meaningful test coverage on new code.

## Scripts

| Script | Description |
|---|---|
| `npm run compile` | TypeScript compilation |
| `npm run watch` | Watch mode compilation |
| `npm run esbuild` | Production bundle |
| `npm run lint` | ESLint |
| `npm test` | Run all tests |
| `npm run vscode:prepublish` | esbuild (pre-publish hook) |
