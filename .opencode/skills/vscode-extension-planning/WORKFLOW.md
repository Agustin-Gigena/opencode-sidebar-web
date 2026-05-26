# 実行ワークフロー

このドキュメントでは、VSCode拡張機能企画スキルの詳細な実行手順を説明します。

## 実行手順

### 1. 初期ヒアリング

ユーザーから以下の情報を収集：

#### 必須項目

- **拡張機能のテーマ・分野**: どのような領域か
  - 言語サポート（シンタックスハイライト、IntelliSense）
  - デバッガー
  - Linter/Formatter
  - スニペット
  - テーマ/アイコン
  - キーマップ
  - 生産性向上ツール
  - Git/SCM統合
  - 外部サービス連携
- **解決したい課題**: 開発者のどんな問題を解決するか
- **対象言語/フレームワーク**: 特定向けか汎用か
- **公開方法**: Marketplace / 社内配布 / 個人利用

#### オプション項目

- **ターゲット開発者**: 想定している利用者層
- **参考拡張機能**: 参考にしている既存の拡張機能
- **UI要件**: サイドバー、Webview、ステータスバー、通知など
- **外部サービス連携**: API連携、認証要件

### 2. アイデアブレインストーミング

#### 2-1. 開発ワークフローの深掘り

- 開発者ペルソナ設定
- 日常の開発フロー分析
- 現在の課題と非効率なポイント

#### 2-2. アイデアの発散

- 3〜5パターンの拡張機能コンセプトを提案
- 各アイデアの独自性
- 類似拡張との差別化

### 3. 市場・競合分析

#### 3-1. 類似拡張機能の調査

- WebSearchでMarketplace内の類似拡張を調査
- インストール数、評価、レビュー分析
- 機能比較と差別化ポイント

#### 3-2. 需要の把握

- 対象言語/フレームワークのユーザー規模
- 既存拡張の不満点（レビュー分析）
- トレンド分析

### 4. MVP機能設計

#### 4-1. コア機能の定義

- 必須機能（Must Have）: 3〜5個に絞る
- 重要機能（Should Have）
- あったらいい機能（Nice to Have）

#### 4-2. 拡張機能タイプの選定

| タイプ | 用途 | 主要API |
|-------|------|---------|
| Language Support | シンタックスハイライト、IntelliSense | languages |
| Debugger | デバッグ機能 | debug |
| Linter/Formatter | コード品質 | languages, workspace |
| Snippets | コードスニペット | languages |
| Theme | カラーテーマ | - |
| Keymaps | キーバインド | - |
| Other | 汎用ツール | 多様 |

#### 4-3. UI設計

| UI要素 | 用途 | 使用API |
|--------|------|---------|
| コマンドパレット | コマンド実行 | commands |
| サイドバー（Tree View） | 一覧表示、階層表示 | window.createTreeView |
| ステータスバー | 状態表示 | window.createStatusBarItem |
| Webview | リッチUI | window.createWebviewPanel |
| 通知 | 情報/警告/エラー | window.showInformationMessage等 |
| Quick Pick | 選択UI | window.showQuickPick |
| Input Box | テキスト入力 | window.showInputBox |

### 5. VSCode API・アクティベーション設計

#### 5-1. 使用するVSCode API

| API | 用途 | 必須/任意 |
|-----|------|----------|
| vscode.commands | コマンド登録 | 必須 |
| vscode.window | UI操作 | 必須 |
| vscode.workspace | ワークスペース操作 | 状況依存 |
| vscode.languages | 言語機能 | 言語サポート時 |
| vscode.debug | デバッグ | デバッガー時 |
| vscode.tasks | タスク | タスク関連時 |
| vscode.scm | SCM連携 | Git連携時 |

#### 5-2. アクティベーションイベント設計

```json
{
  "activationEvents": [
    "onLanguage:javascript",      // 特定言語ファイルを開いた時
    "onCommand:extension.xxx",    // コマンド実行時
    "onView:myViewId",            // カスタムビュー表示時
    "workspaceContains:**/*.js",  // 特定ファイルが存在する時
    "onStartupFinished"           // 起動完了後（非推奨だが必要な場合）
  ]
}
```

**注意**: `"*"`（常時アクティブ）は避ける

#### 5-3. Contribution Points設計

```json
{
  "contributes": {
    "commands": [...],           // コマンド定義
    "menus": {...},              // メニュー配置
    "keybindings": [...],        // キーバインド
    "configuration": {...},      // 設定項目
    "views": {...},              // サイドバービュー
    "viewsContainers": {...},    // ビューコンテナ
    "languages": [...],          // 言語定義
    "snippets": [...],           // スニペット
    "themes": [...]              // テーマ
  }
}
```

### 6. 実装ロードマップ作成

#### 6-1. Phase 1: MVP開発（2〜4週間）

- コア機能の実装
- 基本的なUI
- ローカルテスト

#### 6-2. Phase 2: 公開準備（1〜2週間）

- Marketplace用アセット準備
- README/CHANGELOG整備
- Publisher登録・公開

#### 6-3. Phase 3: 改善・拡張（公開後）

- ユーザーフィードバック収集
- 機能追加
- パフォーマンス改善

### 7. 企画書の作成と保存

全ての分析・設計内容を企画書としてまとめる：

1. 適切なファイル名を生成（例: `vscode-extension-plans/code-time-tracker.md`）
2. 企画書を`vscode-extension-plans/`ディレクトリに保存
3. ファイルパスをユーザーに通知

### 8. 次のステップの提案

企画完了後、以下のアクションを提案：

- **プロトタイピング**: yo codeで基本テンプレート生成
- **技術検証**: 使用予定のVSCode APIの動作確認
- **アイコン作成**: 拡張機能アイコンのデザイン
- **開発着手**: 実装開始
- **ドキュメント**: README.md整備

## 実行例

### ユーザー入力例

```
コーディング時間を自動で計測して、言語別・プロジェクト別に
統計を表示するVSCode拡張機能を作りたいです。
Marketplaceで無料公開したいと考えています。
```

### 実行フロー

1. 初期ヒアリング（追加質問：UI要件、外部連携有無）
2. アイデアブレインストーミング（3パターン提案）
3. 類似拡張調査（WakaTime等を参考）
4. MVP機能設計（計測、統計表示、ステータスバーの3機能）
5. VSCode API設計（workspace, window, statusBar）
6. 開発ロードマップ作成（3週間計画）
7. 企画書を`vscode-extension-plans/code-time-tracker.md`に保存
8. 次のステップを提案（yo codeでテンプレート生成、API検証）
