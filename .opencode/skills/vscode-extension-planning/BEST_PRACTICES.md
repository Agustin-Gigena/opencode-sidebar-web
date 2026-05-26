# ベストプラクティス

このドキュメントでは、VSCode拡張機能企画を成功させるためのベストプラクティスと実践的なガイドラインを提供します。

## 企画の原則

### パフォーマンス最優先

VSCode拡張機能は起動時間とメモリ使用量に大きく影響します：

#### 遅延アクティベーション

```json
// 良い例: 必要な時だけアクティブ化
{
  "activationEvents": [
    "onLanguage:javascript",
    "onCommand:extension.myCommand",
    "onView:myViewId"
  ]
}

// 避けるべき: 常時アクティブ
{
  "activationEvents": ["*"]
}
```

#### バンドルサイズの最小化

```javascript
// esbuildでバンドル・最小化
// package.json
{
  "scripts": {
    "build": "esbuild src/extension.ts --bundle --outfile=out/extension.js --external:vscode --platform=node --minify"
  }
}
```

- 不要な依存関係の削除
- Tree Shakingの活用
- 必要な機能のみインポート

### ユーザー体験重視

#### エディタとのシームレスな統合

```typescript
// VSCodeネイティブのUIを優先
// Quick Pick
const selected = await vscode.window.showQuickPick(items, {
  placeHolder: '選択してください',
  canPickMany: false
});

// Input Box
const input = await vscode.window.showInputBox({
  prompt: '名前を入力してください',
  validateInput: (value) => {
    return value.length > 0 ? null : '名前は必須です';
  }
});

// Progress
await vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: '処理中...',
  cancellable: true
}, async (progress, token) => {
  // 処理
});
```

#### 設定の柔軟性

```json
// package.json - configuration
{
  "contributes": {
    "configuration": {
      "title": "My Extension",
      "properties": {
        "myExtension.enabled": {
          "type": "boolean",
          "default": true,
          "description": "拡張機能を有効にする"
        },
        "myExtension.autoSave": {
          "type": "boolean",
          "default": false,
          "description": "自動保存を有効にする"
        }
      }
    }
  }
}
```

```typescript
// 設定値の取得
const config = vscode.workspace.getConfiguration('myExtension');
const enabled = config.get<boolean>('enabled', true);

// 設定変更の監視
vscode.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration('myExtension')) {
    // 設定変更時の処理
  }
});
```

### 保守性の確保

#### 適切なエラーハンドリング

```typescript
// 良い例: 適切なエラーハンドリング
async function doSomething() {
  try {
    const result = await riskyOperation();
    return result;
  } catch (error) {
    // ユーザーに通知
    vscode.window.showErrorMessage(`エラー: ${error.message}`);
    // ログ出力
    console.error('doSomething failed:', error);
    // 必要に応じてテレメトリ送信
  }
}
```

#### Disposableの適切な管理

```typescript
// extension.ts
export function activate(context: vscode.ExtensionContext) {
  // 登録したリソースはcontextで管理
  const command = vscode.commands.registerCommand('extension.myCommand', () => {
    // 処理
  });
  context.subscriptions.push(command);

  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right
  );
  context.subscriptions.push(statusBar);

  // イベントリスナー
  const listener = vscode.workspace.onDidSaveTextDocument(doc => {
    // 処理
  });
  context.subscriptions.push(listener);
}

export function deactivate() {
  // 必要に応じてクリーンアップ処理
}
```

### Webview使用時のセキュリティ

```typescript
// Webviewの安全な作成
const panel = vscode.window.createWebviewPanel(
  'myWebview',
  'My Webview',
  vscode.ViewColumn.One,
  {
    enableScripts: true,
    localResourceRoots: [
      vscode.Uri.joinPath(context.extensionUri, 'media')
    ],
    retainContextWhenHidden: false  // メモリ節約
  }
);

// Content Security Policyの設定
function getWebviewContent(webview: vscode.Webview) {
  const nonce = getNonce();
  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  </head>
  <body>
    <script nonce="${nonce}">
      // 安全なスクリプト
    </script>
  </body>
  </html>`;
}
```

## Marketplace公開のコツ

### 良いREADMEの書き方

```markdown
# Extension Name

![Visual Studio Marketplace Version](badge-url)
![Visual Studio Marketplace Installs](badge-url)

短い説明文（1-2文）

## Features

- 機能1の説明
- 機能2の説明

![Demo GIF](images/demo.gif)

## Requirements

- 必要な環境・依存関係

## Extension Settings

| 設定 | 説明 | デフォルト |
|------|------|----------|
| `ext.setting1` | 説明 | `true` |

## Known Issues

- 既知の問題があれば記載

## Release Notes

### 1.0.0

- Initial release

## License

MIT
```

### SEO最適化

```json
// package.json
{
  "displayName": "検索されやすい名前",  // 最初の200文字が重要
  "description": "詳細な説明を記載",
  "categories": ["Other", "Linters"],
  "keywords": ["keyword1", "keyword2", "keyword3"]
}
```

## よくある失敗パターンと対策

### 失敗パターン1: 起動時間の遅延

**症状**: VSCode起動が遅くなる

**原因**:
- `"*"`アクティベーション
- 大きな依存関係
- 起動時の重い処理

**対策**:
- 適切なアクティベーションイベント
- バンドルサイズの最小化
- 遅延初期化

### 失敗パターン2: メモリリーク

**症状**: 長時間使用でメモリ消費増加

**原因**:
- Disposableの未解放
- イベントリスナーの未解除
- 大きなオブジェクトの保持

**対策**:
- context.subscriptions.pushの徹底
- 不要になったリソースの明示的解放
- WeakMapの活用

### 失敗パターン3: Marketplace埋没

**症状**: インストールされない

**原因**:
- 不適切な名前・説明
- 低品質なスクリーンショット
- 更新頻度の低さ

**対策**:
- SEO最適化
- 魅力的なスクリーンショット/GIF
- 定期的なアップデート

### 失敗パターン4: VSCode APIの誤用

**症状**: 動作不安定、VSCodeの警告

**原因**:
- 非推奨APIの使用
- APIの誤った使い方
- バージョン非互換

**対策**:
- 公式ドキュメントの熟読
- API変更のウォッチ
- 最小対応バージョンの適切な設定

## 企画フェーズ別のポイント

### Phase 1: アイデア創出

#### やるべきこと
- 自分の開発ワークフローの非効率を分析
- Marketplaceで類似拡張を調査
- レビューから改善点を発見

#### 避けるべきこと
- 既存拡張の完全コピー
- 需要のない機能
- 差別化のない後発

### Phase 2: 設計

#### やるべきこと
- 遅延アクティベーション設計
- VSCodeネイティブUI優先
- 設定項目の検討

#### 避けるべきこと
- `"*"`アクティベーション
- 不要なWebview使用
- 過剰な機能

### Phase 3: 開発

#### やるべきこと
- TypeScript使用
- テスト作成
- パフォーマンス計測

#### 避けるべきこと
- テストなし開発
- エラーハンドリング不足
- Disposable管理の軽視

### Phase 4: 公開

#### やるべきこと
- 高品質なREADME
- スクリーンショット/GIF
- 適切なカテゴリ・タグ

#### 避けるべきこと
- 雑なドキュメント
- 低品質なアセット
- 不適切なカテゴリ選択

## チェックリスト

### 企画完了時
- [ ] ターゲット開発者が明確
- [ ] 競合を3つ以上分析した
- [ ] 差別化ポイントが明確
- [ ] コア機能が3〜5個に絞られている
- [ ] 使用するVSCode APIが選定済み

### 開発前
- [ ] アクティベーションイベント設計完了
- [ ] UI設計完了（コマンド、メニュー、設定）
- [ ] Contribution Points設計完了
- [ ] テスト方針策定

### 公開前
- [ ] README.md完成
- [ ] CHANGELOG.md完成
- [ ] アイコン作成済み（128x128）
- [ ] スクリーンショット/GIF準備済み
- [ ] Publisher登録済み
- [ ] テスト十分
- [ ] パフォーマンス確認

### 公開後
- [ ] ユーザーフィードバック監視
- [ ] 評価・レビュー対応
- [ ] VSCode APIの更新監視
- [ ] 定期的なアップデート計画

すべてチェックできたら、Marketplace公開準備完了です！
