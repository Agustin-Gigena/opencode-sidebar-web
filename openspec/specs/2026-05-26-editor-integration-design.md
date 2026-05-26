# Editor Integration — OpenCode Sidebar Web

**Date:** 2026-05-26
**Status:** Draft
**Version:** 1.0

## Overview

Add three editor integration features to the OpenCode Sidebar Web VS Code extension: inline code actions (Explain, Refactor, Fix, Docs) via the OpenCode API, sending selected code to the chat panel with file context, and auto-linking the active file to the OpenCode session.

## Architecture

A new `OpenCodeAPI` module is added alongside the existing modules. All communication with the OpenCode server goes through the existing proxy in `OpenCodeServer`.

```
extension.ts
  ├── OpenCodeServer   (existing: process + proxy)
  ├── OpenCodePanel    (existing: webview + iframe)
  └── OpenCodeAPI      (NEW: HTTP client for OpenCode endpoints)
```

`OpenCodeAPI` handles:
- API endpoint discovery
- Sending prompts for inline code actions
- Sending file/code context to the active session
- Authentication via `OPENCODE_SERVER_PASSWORD`

## Feature 1: Inline Code Actions

### Trigger points
- **CodeLens**: appears above a selection when text is selected in the editor (4 actions: Explain, Refactor, Fix, Docs)
- **Context menu**: right-click menu in the editor with submenu "OpenCode > Explain / Refactor / Fix / Docs"
- **Commands**: 4 new commands registered (`opencode-sidebar-web.explainSelection`, etc.)

### CodeLens provider
A new file `src/CodeLensProvider.ts` implements `vscode.CodeLensProvider`. It checks if the active editor has a non-empty selection and returns 4 CodeLens entries at the selection range.

### API call flow
1. User selects code and triggers an action
2. Extension calls `OpenCodeAPI.complete()` with the selected code and a system prompt specific to the action
3. The request goes through the existing proxy to `POST /chat/completions` (OpenAI-compatible format)
4. Response is streamed or returned as a single completion

### System prompts

| Action | Prompt |
|---|---|
| Explain | "Explain the following code concisely, focusing on what it does and why." |
| Refactor | "Suggest a refactored version of this code. Show the improved version and explain why it's better." |
| Fix | "Identify bugs or issues in this code and provide fixes." |
| Docs | "Generate JSDoc-style documentation for this code." |

### Result display

| Action | Display method |
|---|---|
| Explain | Hover decoration over the selected code range |
| Refactor | Quick pick: "Apply suggestion?" with preview diff option |
| Fix | Quick pick: "Apply fix?" with preview diff option |
| Docs | Hover decoration showing generated doc comment |

If the server is not running, show a notification with a "Start Server" button.

## Feature 2: Send to Chat

### Trigger
- Context menu on text selection: "Send to OpenCode"
- Keyboard shortcut (configurable)

### Behavior
1. Extracts the relative file path, selected line range, and code content
2. Calls `OpenCodeAPI.setContext({ filePath, lines, code })` to pass the code as session context
3. Sends a `postMessage({ type: 'addToChatInput', filePath, lines })` to the webview
4. The webview forwards the message to the iframe (OpenCode web UI) via `iframe.contentWindow.postMessage()`
5. The file reference appears in the chat input as `📎 src/foo.ts:10-25`

### Fallback
If the OpenCode API does not expose a context endpoint, only the postMessage path is used.

## Feature 3: Auto-link Active File

### Trigger
`window.onDidChangeActiveTextEditor` event.

### Behavior
1. When the active editor changes, extract the relative file path, language ID, and workspace folder
2. Debounce 500ms to avoid rapid successive calls
3. Call `OpenCodeAPI.setActiveContext({ filePath, language, workspaceFolder })`
4. Send `postMessage({ type: 'setActiveFile', filePath })` to the webview
5. The webview updates a new element in the status bar: `📄 src/foo.ts`

### Setting
New setting `opencode-sidebar-web.autoLinkActiveFile` (boolean, default: true) to disable auto-linking.

### Status bar update
The panel's status bar gains a new section between the port label and the Logs link:

```
● Connected  port 4321     📄 src/foo.ts     Logs  Settings  Close
```

## New Dependencies

None. Uses only the existing VS Code API and the HTTP proxy already in place.

## Files to Create

| File | Purpose |
|---|---|
| `src/OpenCodeAPI.ts` | HTTP client for OpenCode server API |
| `src/CodeLensProvider.ts` | CodeLens provider for inline actions |

## Files to Modify

| File | Changes |
|---|---|
| `src/extension.ts` | Register new commands, CodeLens provider, editor event listeners |
| `src/OpenCodePanel.ts` | Handle new postMessage types, add active file to status bar |
| `package.json` | Register new commands, menus, CodeLens contribution, settings |
| `README.md` | Document new features and settings |

## Testing

- `src/test/editor-integration.test.ts` (new):
  - CodeLensProvider: returns lenses only when text is selected
  - OpenCodeAPI: constructs correct requests, handles auth, handles errors
  - Commands: all 4 code action commands are registered
  - Auto-link: debounce fires correctly
- `src/test/extension.test.ts` (update): add new command registrations to existing test suite

## Future Considerations (not in scope)

- Streaming responses for inline actions
- Multi-model support (selecting which model to use)
- Custom user-defined system prompts
- Inline diff view for refactor/fix suggestions
