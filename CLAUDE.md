# VmmTrackerDataSender - Development Guide

## プロジェクト概要

モバイル端末でMediaPipeによる顔トラッキングを行い、WebRTC DataChannelを使ってローカルネットワーク内のPCにトラッキングデータを送信するシステム。PC側の処理負荷を軽減しつつ、VRMアプリなどで顔トラッキング結果を活用できるようにする。

**対象ユーザー**: 単一ユーザー(複数人同時トラッキングは考慮不要)

## プロジェクト構成

このリポジトリは以下の2つのサブプロジェクトで構成される:

### 1. 静的Webページ (GitHub Pages向け)
- **技術**: MediaPipe (Face Landmarker with BlendShapes), WebSocket
- **機能**:
  - モバイル端末のカメラで顔トラッキング
  - トラッキングデータ(頭部姿勢 + BlendShape 52個)をリアルタイム送信
  - LAN内のPC(.NET受信アプリ)へデータ配信
- **制約**: 単一ページ構成、GitHub Pagesでホスト

### 2. .NET コンソールアプリ (受信側リファレンス実装)
- **技術**: .NET (バージョンは後述の考慮事項を踏まえて決定)
- **機能**:
  - Webページからのデータ受信
  - デシリアライズしてコンソール出力(それ以上の処理は不要)
- **制約**:
  - WPF/Unity 6.0との互換性を考慮(.NET Standard 2.1以下が望ましい可能性)
  - OS依存性は低く保つ
  - 同一LAN内での動作を前提

## 送受信データ仕様

### データ内容
1. **頭部姿勢** (6~7個の数値)
   - 位置: x, y, z (単精度 or 半精度浮動小数点)
   - 回転: Quaternion (x, y, z, w) または Euler角

2. **BlendShape** (52個)
   - MediaPipeから0.0~1.0の値を取得
   - 送信時は0~255の1byte整数に変換

### データフォーマット (2種類サポート)

#### Compressed フォーマット
- バイナリ形式で固定順序で配置
- 最小データサイズ、高速処理向け

#### Readable フォーマット
- Minified JSON形式
- キー構造:
  ```json
  {
    "headPose": {"px":0,"py":0,"pz":0,"rx":0,"ry":0,"rz":0,"rw":1},
    "blendShape": {"eyeLeftBlink":0.5, ...}
  }
  ```

**重要**: フォーマットは将来変更の可能性があるため、データ構造とシリアライズ層を適切に分離すること

## 技術選定の決定事項

**詳細は `TECH_STACK.md` を参照**

### 通信プロトコル: WebSocket
- LAN内通信ではWebRTCとのレイテンシ差がほぼない(1-4ms、全体の1-4%)
- 実装がシンプル、一方向通信に適している

### Web側
- **フレームワーク**: Vanilla JavaScript + TypeScript
- **ビルドツール**: Vite
- **MediaPipe**: @mediapipe/tasks-vision (最新版)
- **WebSocket**: 標準WebSocket API

### .NET側
- **.NETバージョン**: .NET 8 (LTS)
  - コア機能は.NET Standard 2.1ライブラリとして分離 (Unity/WPF互換性)
- **WebSocket**: System.Net.WebSockets (HttpListenerベース)
- **JSON**: System.Text.Json
- **バイナリ**: 手動実装 (BinaryReader/Writer)

### フォルダ構成
```
VmmTrackerDataSender/
├── web/              # Webアプリケーション
├── dotnet/           # .NET受信アプリ
├── docs/             # 技術資料
└── .github/workflows/
```

## 未決定事項 / 検討が必要な項目

- [x] ~~WebRTC DataChannelの妥当性検証~~ → **WebSocket採用**
- [x] ~~Webページのフレームワーク選定~~ → **Vanilla TS + Vite**
- [x] ~~.NETバージョン選定~~ → **.NET 8 + .NET Standard 2.1**
- [x] ~~フォルダ構成~~ → **web/, dotnet/, docs/**
- [x] ~~GitHub Pages デプロイ方法~~ → **GitHub Actions**
- [ ] プロトコル仕様の詳細化 (バイト順、座標系など)

## 将来の拡張可能性

- ハンドトラッキングの追加 (現時点では実装不要、設計時に考慮)

## 開発上の注意事項

### 一般
- このプロジェクトはGitHub上でpublicになる前提
- Requirement.mdは編集禁止 (詳細仕様の参照用)
- このCLAUDE.mdは必要に応じて更新可

### Web側
- モバイル端末での動作を最優先
- カメラアクセス、WebSocket接続の権限処理
- パフォーマンス最適化(バッテリー消費、フレームレート)
- WebSocket接続先(.NET側のIP:Port)の入力UI

### .NET側
- WebSocketサーバーの実装(`System.Net.WebSockets`推奨)
- クロスプラットフォーム性の考慮
- WPF/Unityアプリへの組み込みやすさ
- 受信データのフォーマット(Compressed/Readable)は起動時に指定されることを前提
  - 動的判別は不要

### ネットワーク
- LAN内通信を前提(インターネット越しは考慮不要)
- WebSocket通信 (ws://プロトコル、暗号化は不要)
- .NET側でWebSocketサーバーを起動、Web側からクライアント接続
- セキュリティ: LAN内限定のため最小限でよい

## 参考資料

詳細な要件については `Requirement.md` を参照すること。
