# 技術スタック選定

## プロジェクト構成

```
VmmTrackerDataSender/
├── web/              # 顔トラッキングWebアプリケーション
├── dotnet/           # .NET受信アプリケーション
├── docs/             # 技術資料、プロトコル仕様
├── .github/
│   └── workflows/    # GitHub Pages デプロイ等
├── CLAUDE.md
├── Requirement.md
├── TECH_STACK.md
└── README.md
```

---

## Web側技術スタック

### フレームワーク: **Vanilla JavaScript + TypeScript**

**選定理由:**
- **シンプルさ**: 単一ページアプリで複雑な状態管理が不要
- **ビルドプロセス最小化**: TypeScript → JavaScript変換のみ
- **軽量**: フレームワークのオーバーヘッドなし、モバイルでの高速起動
- **MediaPipe/WebSocket互換性**: 両技術ともVanilla JSで十分実装可能
- **GitHub Pages親和性**: ビルド成果物が単純(HTML, JS, CSS)

**代替案検討:**
- React/Vue/Svelte: 状態管理やコンポーネント化のメリットがあるが、今回の単一ページアプリには過剰
- Vanilla JS(TypeScript無し): 型安全性の欠如により開発体験が低下

### MediaPipe: **@mediapipe/tasks-vision** (最新版)

**バージョン**: 0.10.x 以上 (2026年2月時点の最新安定版を使用)

**使用機能:**
- Face Landmarker
- BlendShapes (52個)

**実装方法:**
- CDN経由または npm パッケージとしてインストール
- WebAssembly (WASM) ベースで動作

### WebSocket: **標準 WebSocket API**

**ライブラリ**: ブラウザ標準の `WebSocket` クラスを使用

**理由:**
- 外部ライブラリ不要
- モバイルブラウザで広くサポート
- シンプルなクライアント実装で十分

### ビルドツール: **Vite** (推奨)

**選定理由:**
- TypeScriptサポート標準装備
- 開発サーバー高速起動(ESM based)
- シンプルな設定
- GitHub Pagesデプロイ対応

**代替案:**
- Webpack: 設定が複雑
- Parcel: Viteより遅い
- esbuild: 設定がより低レベル

### パッケージ管理: **npm**

**理由:**
- 標準的、広く使われている
- package.jsonでの依存管理

---

## .NET側技術スタック

### .NETバージョン: **.NET 8**

**選定理由:**
- **LTS (Long Term Support)**: 2026年11月までサポート
- **最新機能**: 高性能、System.Text.Json標準搭載
- **WebSocket標準サポート**: `System.Net.WebSockets`
- **クロスプラットフォーム**: Windows/macOS/Linux対応

**互換性考慮:**
- **Unity 6.0**: .NET Standard 2.1対応 → .NET 8プロジェクトから.NET Standard 2.1ライブラリを切り出し可能
- **WPF (.NET 6/7/8)**: .NET 8ライブラリをそのまま参照可能
- **WPF (.NET Framework)**: .NET Standard 2.0ライブラリとして切り出せば互換性確保

**アプローチ:**
1. リファレンス実装は.NET 8コンソールアプリとして作成
2. コア機能(WebSocket受信、デシリアライズ)は.NET Standard 2.1ライブラリとして分離
3. Unity/WPFから参照しやすい構造を維持

### WebSocketライブラリ: **System.Net.WebSockets** (標準)

**理由:**
- .NET標準ライブラリ
- 外部依存なし
- 十分な機能と性能

**使用クラス:**
- `HttpListener` または `AspNetCore.WebSockets` (サーバー側)
- `WebSocket` (通信ハンドリング)

**選択肢:**
- **HttpListener**: .NET Standard 2.1対応、シンプル、Unity互換性高い
- **ASP.NET Core**: より高機能だが、Unity統合が複雑化

**推奨**: まずは `HttpListener` ベースで実装

### JSONシリアライゼーション: **System.Text.Json** (標準)

**理由:**
- .NET標準ライブラリ (.NET Core 3.0以降)
- 高速
- 外部依存なし

**代替案:**
- Newtonsoft.Json: より広い.NET Framework互換性があるが、.NET 8では不要

### バイナリシリアライゼーション: **手動実装**

**Compressedフォーマット用:**
- `BinaryReader` / `BinaryWriter`
- `BitConverter`
- 固定レイアウトのバイト配列として処理

**理由:**
- データ構造がシンプル(float/byte配列)
- 外部ライブラリ不要
- 完全な制御が可能

---

## 共通技術選定

### バージョン管理: **Git / GitHub**

- GitHub Pagesでのホスティング
- GitHub Actionsでの自動デプロイ

### CI/CD: **GitHub Actions**

**Web側デプロイ:**
- TypeScriptビルド
- GitHub Pagesへの自動デプロイ
- トリガー: main ブランチへのpush

**NET側:**
- ビルド検証
- テスト実行 (必要に応じて)

---

## データフォーマット実装方針

### Readableフォーマット (JSON)

**構造:**
```json
{
  "headPose": {
    "px": 0.0, "py": 0.0, "pz": 0.0,
    "rx": 0.0, "ry": 0.0, "rz": 0.0, "rw": 1.0
  },
  "blendShape": {
    "eyeBlinkLeft": 128,
    "eyeBlinkRight": 128,
    ...
  }
}
```

**シリアライゼーション:**
- Web: `JSON.stringify()`
- .NET: `System.Text.Json.JsonSerializer`

### Compressedフォーマット (バイナリ)

**レイアウト:**
```
[Head Position: 12 bytes (float32 x 3)]
[Head Rotation: 16 bytes (float32 x 4, Quaternion)]
[BlendShapes: 52 bytes (uint8 x 52)]
Total: 80 bytes
```

**シリアライゼーション:**
- Web: `ArrayBuffer` + `DataView`
- .NET: `BinaryReader` + `BitConverter`

**抽象化:**
- インターフェース/抽象クラスでフォーマットを分離
- 将来的なフォーマット追加に対応

---

## 開発フロー

### Web開発
1. `npm install` で依存インストール
2. `npm run dev` で開発サーバー起動
3. `npm run build` で本番ビルド
4. `dist/` フォルダが GitHub Pages にデプロイされる

### .NET開発
1. `dotnet restore` で依存復元
2. `dotnet build` でビルド
3. `dotnet run` で実行
4. コマンドライン引数でフォーマット選択 (例: `--format compressed`)

---

## 次のステップ

- [ ] Webプロジェクトのセットアップ (`web/` フォルダ)
- [ ] .NETプロジェクトのセットアップ (`dotnet/` フォルダ)
- [ ] GitHub Actions ワークフロー作成
- [ ] プロトコル仕様書の詳細化 (`docs/protocol.md`)
