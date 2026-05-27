import * as vscode from 'vscode';

export class CodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
      return [];
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      return [];
    }

    const range = new vscode.Range(selection.start, selection.end);
    const text = document.getText(range);
    if (!text.trim()) {
      return [];
    }

    return [
      new vscode.CodeLens(range, {
        title: 'Explain',
        command: 'opencode-sidebar-web.explainSelection',
        arguments: [text, range],
      }),
      new vscode.CodeLens(range, {
        title: 'Refactor',
        command: 'opencode-sidebar-web.refactorSelection',
        arguments: [text, range],
      }),
      new vscode.CodeLens(range, {
        title: 'Fix',
        command: 'opencode-sidebar-web.fixSelection',
        arguments: [text, range],
      }),
      new vscode.CodeLens(range, {
        title: 'Docs',
        command: 'opencode-sidebar-web.docsSelection',
        arguments: [text, range],
      }),
    ];
  }
}
