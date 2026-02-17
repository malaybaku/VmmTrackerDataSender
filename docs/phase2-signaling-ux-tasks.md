# Phase 2: シグナリングUX改善 - タスクリスト

## 目的

SDP圧縮 + QRコード/base64テキストによるシグナリングを実装し、手動SDP交換を不要にする。

---

## 全体フロー（目標UX）

1. PC (.NET) がOffer SDPを生成 → 圧縮 → QRコード + base64テキストとして表示
2. モバイル (Web) がQRスキャンまたはbase64テキスト貼り付けでOfferを取得
3. モバイルがAnswer SDPを生成 → 圧縮 → QRコード + base64テキストとして表示
4. PC がwebcamでQRスキャンまたはbase64テキスト貼り付けでAnswerを取得
5. 接続確立、トラッキングデータ送受信開始

**設計方針**:
- Vanilla ICE（ICE候補をすべて収集してからSDP交換）でICE候補の個別交換を不要にする
- SDP圧縮で必要最小限のデータ（55-100byte程度）に削減し、QR Version 3-4に収める
- QRスキャンとbase64テキスト貼り付けの両方をサポート（webcamがない環境のフォールバック）

---

## 進捗サマリー

- **Phase 2-A (SDP圧縮プロトコル)**: ✅ 完了 (4/4タスク)
- **Phase 2-B (ライブラリ導入 + Vanilla ICE)**: ✅ 完了 (3/3タスク)
- **Phase 2-C (Web側UX)**: 🔶 一部完了 (2/5タスク) — C-4, C-5は2-Bで実施済み、C-1〜C-3が残り
- **Phase 2-D (.NET側UX)**: 🔶 一部完了 (2/4タスク) — D-3, D-4は2-Bで実施済み、D-1〜D-2が残り
- **Phase 2-E (統合テスト)**: ⏳ 未実施 (0/3タスク)

---

## タスク構成

### Phase 2-A: SDP圧縮プロトコル

- [x] **Task A-1**: 圧縮フォーマット仕様の策定
  - SDPから抽出する必須フィールドの確定:
    - DTLSフィンガープリント (SHA-256, 32byte raw)
    - ICE ufrag (可変長)
    - ICE pwd (可変長)
    - ICE候補 (host候補のみ: IP4 4byte + port 2byte + 各種フラグ)
    - setup role (active/passive/actpass)
  - バイナリフォーマット定義（マジックバイト、バージョン、各フィールドのレイアウト）
  - base64エンコード後のサイズ見積もり
  - ICE credentialのフィンガープリントからの導出（HKDF）を採用するかの判断
    - 採用すればufrag/pwdの送信が不要（~26byte節約）
    - 複雑さとのトレードオフ
  - 成果物: `docs/sdp-compression-spec.md`

- [x] **Task A-2**: TypeScript実装（Web側エンコーダ/デコーダ）
  - ファイル: `web/src/sdp-codec.ts`（新規）
  - `compressSdp(sdp: string, iceCandidates: RTCIceCandidate[]): Uint8Array`
  - `decompressSdp(data: Uint8Array): { sdp: string, iceCandidates: RTCIceCandidateInit[] }`
  - base64変換ユーティリティ
  - SDPテンプレートからの復元ロジック

- [x] **Task A-3**: C#実装（.NET側エンコーダ/デコーダ）
  - ファイル: `dotnet/VmmTrackerCore/SdpCodec.cs`（新規、.NET Standard 2.1）
  - Web側と同一フォーマットを処理
  - SIPSorceryのSDP型との変換

- [x] **Task A-4**: 相互運用性テスト
  - Web側でエンコード → .NET側でデコード（Offer方向の逆も含む）
  - .NET側でエンコード → Web側でデコード
  - テストベクター（固定入力に対する期待出力）を用意
  - エッジケース: IPv6候補、候補なし、長いufrag/pwd

---

### Phase 2-B: ライブラリ導入

- [x] **Task B-1**: Web側 QRコードライブラリ導入
  - QR生成: `qrcode`（npm）の導入、Viteビルドとの統合確認
  - QR読み取り: `jsQR` または `@aspect-build/qr-scanner` の選定・導入
  - ライセンス確認（MIT等であること）
  - `index.html` ライセンスモーダルへの追記

- [x] **Task B-2**: .NET側 QRコードライブラリ導入
  - QR生成: `QRCoder`（NuGet）の導入
    - コンソールでのASCII表示、または画像ファイル出力を検討
  - QR読み取り: `ZXing.Net`（NuGet）の導入
    - webcamキャプチャ方法の選定（AForge.NET / OpenCvSharp / MediaFoundation）
  - ライセンス確認
  - `.csproj` 更新

- [x] **Task B-3**: Vanilla ICE対応
  - Web側: ICE gathering完了を待ってからSDP圧縮を実行する仕組み
    - `RTCPeerConnection.iceGatheringState === 'complete'` の監視
    - または `onicecandidate` の `null` イベントを待機
  - .NET側: SIPSorceryでのICE gathering完了待ちの実装
  - タイムアウト処理（候補収集が長引いた場合のフォールバック）

---

### Phase 2-C: Web側UX改修

- [ ] **Task C-1**: 接続UIの再設計
  - 現在のSDP手動入力UI（textarea × 3 + ボタン群）を撤去
  - 新しいステップ型UIに置き換え:
    - Step 1: 「PC側QRをスキャン」ボタン + base64テキスト入力欄
    - Step 2: 「接続中...」（ICE gathering待ち）
    - Step 3: Answer QRコード表示 + base64テキスト表示（コピーボタン付き）
    - Step 4: 接続完了表示
  - フォーマット選択（compressed/readable）はUIに残す

- [ ] **Task C-2**: QRスキャン機能（Offer読み取り）
  - カメラを使ったQRスキャンモードの実装
  - スキャン成功時にカメラモードをフェイストラッキング用に自動切替
  - スキャン中のプレビュー表示
  - スキャン失敗時のエラーハンドリング

- [ ] **Task C-3**: QR/base64表示機能（Answer表示）
  - 圧縮Answer SDPからQRコード画像を生成・表示
  - 同時にbase64テキストを表示（コピーボタン付き）
  - QRコードは画面上で十分なサイズで表示（PC webcamでスキャンしやすいように）

- [x] **Task C-4**: WebRTCManagerの改修（Phase 2-Bで実施済み）
  - Vanilla ICE対応: Offer受信 → Answer生成 → ICE収集完了待ち → 圧縮SDP出力
  - `initializeAsAnswerer` のフローを圧縮SDP対応に変更
  - ICE候補の個別交換UIを廃止

- [x] **Task C-5**: 既存コードのクリーンアップ（Phase 2-Bで実施済み）
  - 旧SDP手動交換関連のHTML/TSコードを削除
  - 不要になったイベントハンドラの削除
  - SignalingData型の更新または削除

---

### Phase 2-D: .NET側UX改修

- [ ] **Task D-1**: QRコード表示（Offer）
  - Offer SDP生成 → ICE gathering完了待ち → 圧縮 → QRコード生成
  - コンソールでのQR表示方法を実装（ASCII art or 画像ファイル表示）
  - 同時にbase64テキストもコンソール出力（コピー用）

- [ ] **Task D-2**: QRスキャン機能（Answer読み取り）
  - webcamからのフレームキャプチャ
  - ZXing.NetでQRデコード
  - スキャン成功時のAnswer SDP復元・設定
  - webcamがない場合のフォールバック: base64テキストのコンソール入力

- [x] **Task D-3**: WebRTCReceiverの改修（Phase 2-Bで実施済み）
  - Vanilla ICE対応
  - 圧縮SDPからのRTCSessionDescription復元
  - Program.csの接続フロー更新（QR表示 → スキャン/入力 → 接続）

- [x] **Task D-4**: 既存コードのクリーンアップ（Phase 2-Bで実施済み）
  - 旧SDP手動交換のコンソールUI削除
  - `ReadMultiLineInput` の削除または用途変更
  - `--role` 引数の廃止（PC側は常にOfferer）

---

### Phase 2-E: 統合テスト

- [ ] **Task E-1**: ローカル環境テスト
  - QRスキャン経由での接続確立
  - base64テキスト経由での接続確立
  - 両フォーマット（compressed / readable）での動作確認

- [ ] **Task E-2**: GitHub Pagesテスト
  - HTTPS環境でのQRスキャン動作確認
  - カメラ切り替え（QRスキャン → フェイストラッキング）の動作確認

- [ ] **Task E-3**: モバイル端末テスト
  - モバイルでのQRスキャンUX確認
  - Answer QRコードのPC webcamでのスキャン確認
  - base64テキストフォールバックの確認

---

## 完了条件

### 必須条件
- [ ] SDP圧縮フォーマットがWeb/.NET間で相互運用可能
- [ ] QRコードまたはbase64テキストでOffer/Answerを交換し接続確立できる
- [ ] ICE候補の手動交換が不要（Vanilla ICEで完結）
- [ ] モバイルからGitHub Pages経由で接続成功

### オプション条件
- [ ] ICE credentialのHKDF導出による追加圧縮
- [ ] 複数候補（IPv4 + IPv6）対応
- [ ] 接続エラー時のリトライUI

---

## 注意事項

- モバイルのカメラはQRスキャンとフェイストラッキングで共用するため、切り替えの制御が必要
- QRコードのサイズは圧縮SDP次第。55-100byteならVersion 3-4で十分
- .NET側のwebcamアクセスはプラットフォーム依存が出やすい。Windows前提でまず実装し、クロスプラットフォームは後回し
- Phase 1で追加したSDP正規化（`normalizeSdp`）は圧縮SDP導入後も一部残す可能性あり（フォールバック時）
