# Implementation Plan (Editor Integration Design)

**Status:** Spec-only, no implementation started (0/39 items)

**Last Updated:** 2026-05-26

**Primary Spec:** `specs/architecture/2026-05-26-editor-integration-design.md`

## Quick Reference

| System | Spec | Modules | Artifacts | Status |
|--------|------|---------|-----------|--------|
| OpenCodeAPI HTTP client | editor-integration-design.md | `src/OpenCodeAPI.ts` | — | ❌ Not started |
| CodeLens provider | editor-integration-design.md | `src/CodeLensProvider.ts` | — | ❌ Not started |
| Inline Code Actions (Feature 1) | editor-integration-design.md | `src/extension.ts`, `src/OpenCodePanel.ts`, `package.json` | 4 commands, CodeLens, context menus | ❌ Not started |
| Send to Chat (Feature 2) | editor-integration-design.md | `src/extension.ts`, `src/OpenCodePanel.ts`, `package.json` | Context menu, postMessage, iframe forwarding | ❌ Not started |
| Auto-link Active File (Feature 3) | editor-integration-design.md | `src/extension.ts`, `src/OpenCodePanel.ts`, `package.json` | Editor listener, status bar, setting | ❌ Not started |
| Tests | editor-integration-design.md | `src/test/editor-integration.test.ts`, `src/test/extension.test.ts` | — | ❌ Not started |
| Docs | editor-integration-design.md | `README.md` | — | ❌ Not started |

## Phased Plan

### Phase 1: Core Infrastructure — OpenCodeAPI HTTP Client

**Goal:** Create the `OpenCodeAPI` module that wraps HTTP calls to the OpenCode server via the existing proxy.

**Status:** ❌ Not started

**Paths:**
- `src/OpenCodeAPI.ts` (NEW)

**Checklist:**
- [ ] Create `src/OpenCodeAPI.ts` with the `OpenCodeAPI` class
- [ ] Implement `complete(code, systemPrompt)` — POST to `/chat/completions` in OpenAI-compatible format
- [ ] Implement `setContext({ filePath, lines, code })` — send code as session context
- [ ] Implement `setActiveContext({ filePath, language, workspaceFolder })` — update active file context
- [ ] Authentication via `OPENCODE_SERVER_PASSWORD` as Basic auth header
- [ ] API endpoint discovery from `OpenCodeServer.serverUrl`
- [ ] Error handling (server not running, auth failure, network errors)
- [ ] Factory/helper to instantiate from an existing `OpenCodeServer` instance

**Reference pattern:** `OpenCodeServer.ts` uses `fetch()` with `Authorization` header for health checks; follow same auth pattern.

**Definition of Done:**
- `src/OpenCodeAPI.ts` created and compiles (`npm run compile`)
- Lint passes (`npm run lint`)
- Tests in Phase 6 cover API construction and error handling

**Risks/Dependencies:** None; uses only existing `fetch` + proxy.

---

### Phase 2: Inline Code Actions — CodeLens + Commands

**Goal:** Implement CodeLens provider and register 4 inline code action commands (Explain, Refactor, Fix, Docs).

**Status:** ❌ Not started

**Paths:**
- `src/CodeLensProvider.ts` (NEW)
- `src/extension.ts` (MODIFY)
- `package.json` (MODIFY)

**Checklist:**

#### 2.1 CodeLens Provider
- [ ] Create `src/CodeLensProvider.ts` implementing `vscode.CodeLensProvider`
- [ ] Return 4 CodeLens entries at the selection range when text is selected
- [ ] ProvideCommand for each lens: `explainSelection`, `refactorSelection`, `fixSelection`, `docsSelection`

#### 2.2 Command Registration
- [ ] Register `opencode-sidebar-web.explainSelection` in `src/extension.ts`
- [ ] Register `opencode-sidebar-web.refactorSelection` in `src/extension.ts`
- [ ] Register `opencode-sidebar-web.fixSelection` in `src/extension.ts`
- [ ] Register `opencode-sidebar-web.docsSelection` in `src/extension.ts`
- [ ] Each command calls `OpenCodeAPI.complete()` with action-specific system prompt
- [ ] Each command displays result according to action type
  - Explain → hover decoration over selected code range
  - Refactor → quick pick "Apply suggestion?" with preview diff option
  - Fix → quick pick "Apply fix?" with preview diff option
  - Docs → hover decoration showing generated doc comment
- [ ] Server-not-running guard: show notification with "Start Server" button

#### 2.3 package.json Contributions
- [ ] Register 4 commands in `contributes.commands`
- [ ] Register `CodeLens` contribution point
- [ ] Register `editor/context` menu with submenu "OpenCode > Explain / Refactor / Fix / Docs"
- [ ] Register optional keybindings for code actions

#### 2.4 Registration in extension.ts
- [ ] Register `CodeLensProvider` with `vscode.languages.registerCodeLensProvider`
- [ ] Pass `OpenCodeAPI` instance to command handlers

**Reference pattern:** Follow existing command registration style in `src/extension.ts` lines 66-143.

**Definition of Done:**
- `src/CodeLensProvider.ts` compiles, lint passes
- `npm run compile` passes
- 4 new commands visible in Command Palette
- CodeLens appears above selected text
- Context menu shows "OpenCode > ..." submenu

**Risks/Dependencies:** Depends on Phase 1 (OpenCodeAPI). Server must be running and proxy active.

---

### Phase 3: Send to Chat

**Goal:** Allow users to send selected code + file context to the OpenCode chat panel.

**Status:** ❌ Not started

**Paths:**
- `src/extension.ts` (MODIFY)
- `src/OpenCodePanel.ts` (MODIFY)
- `package.json` (MODIFY)

**Checklist:**

#### 3.1 Context Menu + Command
- [ ] Register `opencode-sidebar-web.sendToChat` command
- [ ] Add `editor/context` menu entry "Send to OpenCode" in `package.json`
- [ ] Register command handler in `src/extension.ts` that:
  - Extracts relative file path, selected line range, and code content from active editor
  - Calls `OpenCodeAPI.setContext({ filePath, lines, code })`
  - Sends `postMessage({ type: 'addToChatInput', filePath, lines })` to webview

#### 3.2 OpenCodePanel Message Handling
- [ ] Add handler for `addToChatInput` message type in `onDidReceiveMessage`
- [ ] Post message to iframe via `iframe.contentWindow.postMessage()`
- [ ] Origin handling: use current iframe src origin

#### 3.3 Keyboard Shortcut
- [ ] Register configurable keybinding in `package.json`

**Reference pattern:** Message handling in `OpenCodePanel.ts` lines 31-48 for `onDidReceiveMessage`.

**Definition of Done:**
- "Send to OpenCode" appears in right-click context menu on selected text
- Message reaches webview iframe
- Server-not-running guard works

**Risks/Dependencies:** Depends on Phase 1. The `addToChatInput` iframe message protocol must be compatible with OpenCode web UI expectations (may need adjustment).

---

### Phase 4: Auto-link Active File

**Goal:** Automatically send the active file path to the OpenCode session when the user switches editors.

**Status:** ❌ Not started

**Paths:**
- `src/extension.ts` (MODIFY)
- `src/OpenCodePanel.ts` (MODIFY)
- `package.json` (MODIFY)

**Checklist:**

#### 4.1 Editor Listener
- [ ] Subscribe to `window.onDidChangeActiveTextEditor` in `src/extension.ts`
- [ ] Implement 500ms debounce to avoid rapid successive calls
- [ ] Extract: relative file path, language ID, workspace folder
- [ ] Call `OpenCodeAPI.setActiveContext({ filePath, language, workspaceFolder })`
- [ ] Send `postMessage({ type: 'setActiveFile', filePath })` to webview

#### 4.2 OpenCodePanel Status Bar Update
- [ ] Add active file section between port label and Logs link in HTML status bar: `📄 src/foo.ts`
- [ ] Handle `setActiveFile` message type in `onDidReceiveMessage`
- [ ] Update status bar HTML dynamically when file changes

#### 4.3 Setting
- [ ] Add `opencode-sidebar-web.autoLinkActiveFile` boolean setting (default: `true`) in `package.json`
- [ ] Read setting in listener and skip when disabled

**Reference pattern:** Status bar rendering in `OpenCodePanel.ts` lines 116-131. Settings pattern in `package.json` lines 127-174.

**Definition of Done:**
- Active file appears in panel status bar when switching editors
- Setting can disable auto-linking
- 500ms debounce prevents rapid updates

**Risks/Dependencies:** Depends on Phase 1. Status bar layout changes may need CSS adjustment for the additional element.

---

### Phase 5: OpenCodePanel Enhancements

**Goal:** Extend `OpenCodePanel` to handle new postMessage types from Features 1-3 and support the expanded status bar.

**Status:** ❌ Not started

**Paths:**
- `src/OpenCodePanel.ts` (MODIFY)

**Checklist:**
- [ ] Add message handler for `addToChatInput` → forward to iframe via `postMessage`
- [ ] Add message handler for `setActiveFile` → update status bar
- [ ] Add message handler for code action results (if any panel-side rendering needed)
- [ ] Add active file element in status bar HTML
- [ ] Maintain backward compatibility with existing message types

**Reference pattern:** `onDidReceiveMessage` switch in `OpenCodePanel.ts` lines 31-48.

**Definition of Done:**
- All new postMessage types are handled
- Status bar shows active file when applicable
- Existing message types (`closePanel`, `startServer`, `showLogs`, `openSettings`) continue working

**Risks/Dependencies:** Phase 3 and 4 depend on this.

---

### Phase 6: Tests

**Goal:** Write tests for all new modules and verify existing command registration tests are updated.

**Status:** ❌ Not started

**Paths:**
- `src/test/editor-integration.test.ts` (NEW)
- `src/test/extension.test.ts` (MODIFY)

**Checklist:**

#### 6.1 editor-integration.test.ts
- [ ] CodeLensProvider: returns lenses only when text is selected
- [ ] CodeLensProvider: returns empty array when no selection
- [ ] OpenCodeAPI: constructs correct request URL and body for `complete()`
- [ ] OpenCodeAPI: handles auth via `OPENCODE_SERVER_PASSWORD`
- [ ] OpenCodeAPI: handles server-not-running error gracefully
- [ ] Commands: all 4 code action commands are registered
- [ ] Commands: `sendToChat` is registered
- [ ] Auto-link: 500ms debounce fires correctly (timing test)
- [ ] Auto-link: setting `autoLinkActiveFile: false` prevents listener from firing

#### 6.2 extension.test.ts Update
- [ ] Add new command registrations to existing "Commands are registered" test
  - `opencode-sidebar-web.explainSelection`
  - `opencode-sidebar-web.refactorSelection`
  - `opencode-sidebar-web.fixSelection`
  - `opencode-sidebar-web.docsSelection`
  - `opencode-sidebar-web.sendToChat`

**Reference pattern:** Existing tests in `src/test/extension.test.ts` for command registration patterns. Mock utilities in `src/test/test-utils.ts`.

**Definition of Done:**
- `npm test` passes with new tests
- Lint passes (`npm run lint`)

**Risks/Dependencies:** Depends on all prior phases.

---

### Phase 7: Documentation

**Goal:** Update README.md to document new features and settings.

**Status:** ❌ Not started

**Paths:**
- `README.md` (MODIFY)

**Checklist:**
- [ ] Document Inline Code Actions (CodeLens, context menu, commands)
- [ ] Document Send to Chat feature
- [ ] Document Auto-link Active File feature
- [ ] Document new setting `opencode-sidebar-web.autoLinkActiveFile`

**Definition of Done:**
- README reflects all new features

**Risks/Dependencies:** None.

---

### Phase 8: Quality Gate Verification

**Goal:** Run all quality gates and fix any issues.

**Status:** ❌ Not started

**Paths:** All modified and new files.

**Checklist:**
- [ ] `npm run compile` — TypeScript compilation passes
- [ ] `npm run lint` — ESLint passes
- [ ] `npm run esbuild` — Production bundle builds successfully
- [ ] `npm test` — All tests pass

**Definition of Done:** All 4 commands pass without errors.

**Risks/Dependencies:** Depends on all prior phases.

## Verification Log

| Date | Verification | Command/URL | Result | Files Touched |
|------|-------------|-------------|--------|---------------|
| 2026-05-26 | Spec exists | `specs/architecture/2026-05-26-editor-integration-design.md` | Present, Draft status | — |
| 2026-05-26 | OpenCodeAPI.ts exists | Checked `src/` listing | **MISSING** | — |
| 2026-05-26 | CodeLensProvider.ts exists | Checked `src/` listing | **MISSING** | — |
| 2026-05-26 | New commands in extension.ts | Read `src/extension.ts` | **MISSING** (no explain/refactor/fix/docs/sendToChat) | — |
| 2026-05-26 | New postMessage handlers in OpenCodePanel.ts | Read `src/OpenCodePanel.ts` | **MISSING** (no addToChatInput/setActiveFile handling) | — |
| 2026-05-26 | package.json commands | Read `package.json` contributes.commands | **MISSING** (no editor integration commands) | — |
| 2026-05-26 | package.json menus | Read `package.json` contributes.menus | **MISSING** (no editor/context for OpenCode) | — |
| 2026-05-26 | package.json CodeLens | Read `package.json` | **MISSING** (no codelens contribution point) | — |
| 2026-05-26 | autoLinkActiveFile setting | Read `package.json` configuration | **MISSING** | — |
| 2026-05-26 | editor-integration.test.ts | Checked `src/test/` listing | **MISSING** | — |
| 2026-05-26 | extension.test.ts updated | Read `src/test/extension.test.ts` | **NOT UPDATED** (7 commands, should be 12) | — |
| 2026-05-26 | README updated | Read `README.md` | **NOT UPDATED** (no editor integration mentions) | — |

## Summary

| Phase | Description | Status | Checklist Items |
|-------|-------------|--------|----------------|
| 1 | OpenCodeAPI HTTP Client | ❌ Not started | 8 |
| 2 | Inline Code Actions | ❌ Not started | 13 |
| 3 | Send to Chat | ❌ Not started | 6 |
| 4 | Auto-link Active File | ❌ Not started | 6 |
| 5 | OpenCodePanel Enhancements | ❌ Not started | 4 |
| 6 | Tests | ❌ Not started | 9 |
| 7 | Documentation | ❌ Not started | 4 |
| 8 | Quality Gate Verification | ❌ Not started | 4 |
| **Total** | | | **54 checklist items** |

**Remaining effort:** 54/54 items not started. All 3 features (Inline Code Actions, Send to Chat, Auto-link Active File) are unimplemented. The spec was committed alongside Ralph/linting infrastructure, with no code changes.

## Known Existing Work

- **None.** The entire editor integration feature space is unimplemented. No partial implementations, TODOs, or stubs exist in the codebase.

## Manual Deployment Tasks

None — all features are code-only with no external service setup required.
