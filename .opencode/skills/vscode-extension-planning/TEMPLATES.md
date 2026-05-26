# 企画書テンプレート

このドキュメントでは、VSCode拡張機能企画書の標準フォーマットを定義します。

## 保存先

企画書は`vscode-extension-plans/[extension-name].md`に保存してください。

## フォーマットテンプレート

```markdown
# VSCode拡張機能企画書: [拡張機能名]

**企画者**: [ユーザー名/チーム名]
**作成日時**: YYYY-MM-DD
**バージョン**: 1.0
**ステータス**: 企画中 / 開発中 / Marketplace公開済み

---

## 1. エグゼクティブサマリー

### 拡張機能概要
[拡張機能の一文説明]

### 解決する課題
[開発者が抱える問題]

### ターゲット開発者
[具体的なペルソナ]

### 対象言語/フレームワーク
[特定言語向け / 汎用]

### 独自性・差別化ポイント
[類似拡張との違い]

---

## 2. 市場・競合分析

### 2-1. 類似拡張機能の調査

| 拡張機能名 | インストール数 | 評価 | 強み | 弱み |
|-----------|--------------|------|------|------|
| 競合A     | 100K         | 4.5  | ... | ... |
| 競合B     | 50K          | 4.2  | ... | ... |
| 競合C     | 20K          | 4.0  | ... | ... |

### 2-2. 差別化戦略
- [競合との差別化ポイント]
- [独自の価値提案]

---

## 3. ユーザー設定

### ペルソナ1: [名前]
- **職種**: [フロントエンドエンジニア / バックエンドエンジニア / etc.]
- **使用言語**: [...]
- **課題**: [...]
- **期待する解決**: [...]

### ペルソナ2: [名前]（必要に応じて追加）
[...]

---

## 4. 機能設計（MVP）

### 4-1. 拡張機能タイプ
- [ ] Language Support
- [ ] Debugger
- [ ] Linter/Formatter
- [ ] Snippets
- [ ] Theme
- [ ] Keymaps
- [ ] Other

### 4-2. コア機能

1. **[機能名1]**
   - 説明: [...]
   - 優先度: Must Have
   - UI: コマンドパレット / サイドバー / ステータスバー / etc.
   - 使用API: [...]

2. **[機能名2]**
   - 説明: [...]
   - 優先度: Must Have
   - UI: [...]
   - 使用API: [...]

3. **[機能名3]**
   - 説明: [...]
   - 優先度: Should Have
   - UI: [...]
   - 使用API: [...]

### 4-3. コマンド一覧

| コマンドID | タイトル | キーバインド | 説明 |
|-----------|---------|-------------|------|
| extension.command1 | My Command 1 | Ctrl+Shift+X | ... |
| extension.command2 | My Command 2 | - | ... |
| ... | ... | ... | ... |

### 4-4. UI設計

#### サイドバー（該当する場合）
- **View Container ID**: [myExtensionContainer]
- **View ID**: [myTreeView]
- **表示内容**: [ツリー構造の説明]

#### Webview（該当する場合）
- **用途**: [リッチUIが必要な理由]
- **フレームワーク**: React / Vue / Svelte / Vanilla
- **通信**: postMessage API

#### ステータスバー
- **位置**: 左 / 右
- **表示内容**: [...]
- **クリック時動作**: [...]

---

## 5. VSCode API・設定設計

### 5-1. 使用するVSCode API

| API | 用途 | 必須/任意 |
|-----|------|----------|
| vscode.commands | コマンド登録 | 必須 |
| vscode.window | UI操作 | 必須 |
| vscode.workspace | ファイル操作 | 任意 |
| vscode.languages | 言語機能 | 任意 |
| ... | ... | ... |

### 5-2. アクティベーションイベント

```json
{
  "activationEvents": [
    "onLanguage:xxx",
    "onCommand:extension.xxx",
    "onView:xxx"
  ]
}
```

### 5-3. Contribution Points

```json
{
  "contributes": {
    "commands": [
      {
        "command": "extension.command1",
        "title": "My Command 1",
        "category": "My Extension"
      }
    ],
    "menus": {
      "commandPalette": [...],
      "editor/context": [...]
    },
    "keybindings": [
      {
        "command": "extension.command1",
        "key": "ctrl+shift+x",
        "mac": "cmd+shift+x"
      }
    ],
    "configuration": {
      "title": "My Extension",
      "properties": {
        "myExtension.setting1": {
          "type": "boolean",
          "default": true,
          "description": "..."
        }
      }
    },
    "views": {...},
    "viewsContainers": {...}
  }
}
```

### 5-4. 設定項目（Configuration）

| 設定キー | 型 | デフォルト | 説明 |
|---------|---|---------|------|
| myExtension.enabled | boolean | true | 拡張機能の有効/無効 |
| myExtension.setting1 | string | "default" | ... |
| myExtension.setting2 | number | 10 | ... |
| ... | ... | ... | ... |

---

## 6. 技術スタック

### 開発環境
- **言語**: TypeScript
- **ビルドツール**: esbuild / webpack / tsc
- **パッケージマネージャー**: npm / yarn / pnpm
- **テスト**: @vscode/test-electron / Mocha

### UI（Webview使用時）
- **フレームワーク**: React / Vue / Svelte / Vanilla
- **スタイリング**: [...]
- **ビルド**: [...]

### 外部連携（該当する場合）
- **API**: [...]
- **認証**: [...]

### 選定理由
| 技術 | 選定理由 | 代替案 |
|------|---------|--------|
| TypeScript | 型安全性、VSCode開発推奨 | JavaScript |
| esbuild | 高速ビルド | webpack |
| ... | ... | ... |

---

## 7. 開発ロードマップ

### Phase 1: MVP開発（2〜4週間）
- **Week 1**: 環境構築（yo code）、基本コマンド実装
- **Week 2-3**: コア機能実装
- **Week 4**: テスト、デバッグ

**マイルストーン**: ローカル動作版完成

### Phase 2: Marketplace公開準備（1〜2週間）
- README.md / CHANGELOG.md作成
- アイコン作成（128x128）
- スクリーンショット / GIF準備
- Publisher登録・公開申請

**マイルストーン**: Marketplace公開

### Phase 3: 改善・拡張（公開後）
- ユーザーフィードバック対応
- 機能追加
- パフォーマンス改善
- バグ修正

---

## 8. Marketplace公開戦略

### 拡張機能情報
- **Publisher**: [publisher-name]
- **カテゴリ**: [Programming Languages / Linters / Formatters / Debuggers / etc.]
- **タグ**: [関連タグ]

### 必要なアセット
- [ ] アイコン（128x128 PNG）
- [ ] README.md（機能説明、スクリーンショット）
- [ ] CHANGELOG.md（変更履歴）
- [ ] LICENSE
- [ ] スクリーンショット / GIF

### SEO・発見性向上
- 検索されやすいdisplayName
- 詳細なdescription（最初の200文字が重要）
- 適切なカテゴリとタグ
- 定期的なアップデート

---

## 9. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| VSCode APIの破壊的変更 | 中 | リリースノート監視、早期対応 |
| 類似拡張の出現 | 中 | 差別化機能への集中投資 |
| パフォーマンス問題 | 高 | 遅延アクティベーション、プロファイリング |
| Marketplace埋没 | 中 | SEO最適化、定期的なアップデート |

---

## 10. KPI設定

### 公開後1ヶ月
- インストール数: XXX
- 評価: 4.0以上
- レビュー数: X件

### 公開後3ヶ月
- インストール数: X,XXX
- 週次アクティブユーザー: XXX
- GitHub Stars: XX

---

## 11. 次のステップ

### 即座に実行すべきこと
1. [ ] 開発環境セットアップ（yo code）
2. [ ] 基本コマンドのプロトタイプ
3. [ ] 使用予定APIの動作検証

### 公開前の準備
1. [ ] アイコンデザイン
2. [ ] README.md作成
3. [ ] CHANGELOG.md作成
4. [ ] スクリーンショット準備
5. [ ] Publisher登録

---

## 付録

### 参考資料
- [VSCode Extension API](https://code.visualstudio.com/api)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [類似拡張機能URL]

### 関連ドキュメント
- デザインモックアップ: [リンク]
- 技術仕様書: [リンク]
```

## テンプレート使用のポイント

### 1. アクティベーション設計
- `"*"`は使用しない
- 必要最小限のイベントで起動

### 2. UI設計
- VSCodeネイティブのUIを優先
- Webviewは必要な場合のみ

### 3. 設定項目
- ユーザーがカスタマイズ可能な項目を提供
- 合理的なデフォルト値

### 4. Marketplace対策
- README.mdは充実させる
- スクリーンショット/GIFで機能を視覚的に説明
