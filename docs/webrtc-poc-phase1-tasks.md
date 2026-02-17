# WebRTC DataChannel PoC - フェーズ1 タスクリスト

## 目的

WebRTC DataChannelの基本実装を行い、GitHub Pages（HTTPS）からLAN内PC（.NET）へのデータ送信が可能であることを実証する。

---

## フェーズ1の目標

1. ✅ Web側（GitHub Pages）でWebRTC DataChannelの基本実装 - **完了 (2026-02-16)**
2. ✅ .NET側でSIPSorceryを使ったDataChannel受信実装 - **完了 (2026-02-16)**
3. ⏳ 統合検証（ローカル・GitHub Pages） - **次回実施予定**

---

## 進捗サマリー

- **Phase 1-A (調査・設計)**: ✅ 完了 (4/4タスク)
- **Phase 1-B (Web側実装)**: ✅ 完了 (7/7タスク)
- **Phase 1-C (.NET側実装)**: ✅ 完了 (6/6タスク)
- **Phase 1-D (統合・検証)**: ⏳ 進行中 (4/6タスク)

**残り**: D-2 (エラーハンドリング)、D-3 (ログ整備)

---

## タスク構成

### Phase 1-A: 調査・設計

- [x] **Task A-1**: WebRTC DataChannel API仕様の確認 ✅
  - RTCPeerConnection、RTCDataChannelのブラウザAPI仕様
  - SDP（Session Description Protocol）のフォーマット確認
  - ICE Candidateの仕組み理解
  - 参考: [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
  - **完了日**: 2026-02-16

- [x] **Task A-2**: SIPSorceryライブラリの調査 ✅
  - インストール方法確認
  - DataChannel関連APIの確認
  - サンプルコードの実行
  - 参考: [SIPSorcery GitHub](https://github.com/sipsorcery-org/sipsorcery)
  - **完了日**: 2026-02-16

- [x] **Task A-3**: QRコード生成・読み取りライブラリの選定 ✅
  - Web側: `qrcode.js`または`qrcode-generator`の検討
  - .NET側: `QRCoder`または`ZXing.Net`の検討
  - ライブラリのライセンス確認
  - **完了日**: 2026-02-16

- [x] **Task A-4**: データフォーマット設計 ✅
  - 既存の`TrackingData`型をそのまま使用
  - WebRTC DataChannel経由での送信方法（Binary or JSON）
  - 既存のシリアライザ（compressed/readable）の再利用可能性確認
  - **完了日**: 2026-02-16

---

### Phase 1-B: Web側実装

#### 型定義・基盤整備

- [x] **Task B-1**: WebRTC関連の型定義を追加 ✅
  - `web/src/types.ts`に`WebRTCConnectionState`、`SignalingData`等を追加
  - SDP、ICE Candidate用の型定義
  - **完了日**: 2026-02-16

- [x] **Task B-2**: WebRTCManager クラスの作成 ✅
  - ファイル: `web/src/webrtc.ts` (317行)
  - RTCPeerConnectionの管理
  - DataChannelの作成・管理
  - イベントハンドラ（onopen, onclose, onerror, onmessage）
  - **完了日**: 2026-02-16

#### DataChannel通信実装

- [x] **Task B-3**: DataChannel接続確立フロー実装 ✅
  - Offer SDPの生成
  - Answer SDPの受信・設定
  - ICE Candidateの収集・交換
  - **完了日**: 2026-02-16

- [x] **Task B-4**: TrackingDataの送信実装 ✅
  - 既存の`TrackingData`をDataChannel経由で送信
  - シリアライザの統合（compressed/readable選択可能）
  - 送信レート制御（フレーム毎またはスロットリング）
  - **完了日**: 2026-02-16

#### 仮実装: QRコード（マニュアル入力）

- [x] **Task B-5**: SDP手動入力UI実装（QRコード前の仮実装） ✅
  - Offer SDPをテキストエリアに表示（コピー可能）
  - Answer SDPをテキストエリアで入力（ペースト）
  - ICE Candidateも同様に手動交換
  - 後でQRコードに置き換える前提
  - **完了日**: 2026-02-16

#### UI更新

- [x] **Task B-6**: WebRTC接続状態の表示 ✅
  - 接続状態（Connecting, Connected, Disconnected）の表示
  - DataChannel状態の表示
  - エラーメッセージの表示
  - **完了日**: 2026-02-16

- [x] **Task B-7**: 接続方法の選択UI追加 ✅
  - WebSocket削除、WebRTC専用に変更
  - **完了日**: 2026-02-16

---

### Phase 1-C: .NET側実装

#### 環境準備

- [x] **Task C-1**: SIPSorceryライブラリのインストール ✅
  - `dotnet/VmmTrackerReceiver/VmmTrackerReceiver.csproj`に追加
  - NuGetパッケージ: `SIPSorcery 10.0.3`
  - **完了日**: 2026-02-16

- [x] **Task C-2**: WebRTC DataChannel受信クラスの作成 ✅
  - ファイル: `dotnet/VmmTrackerReceiver/WebRTCReceiver.cs` (323行)
  - `RTCPeerConnection`の初期化
  - DataChannelの受信準備
  - イベントハンドラ設定
  - **完了日**: 2026-02-16

#### SDP処理実装

- [x] **Task C-3**: Offer SDPの生成とAnswer SDPの返信 ✅
  - `CreateOffer()`でOffer SDPを生成
  - Offer SDPをコンソール出力（後でQRコード化）
  - 受信したAnswer SDPを`SetRemoteDescription()`で設定
  - Offerer/Answererの両方をサポート
  - **完了日**: 2026-02-16

- [x] **Task C-4**: ICE Candidateの処理 ✅
  - ICE Candidateの収集
  - 収集したCandidateをコンソール出力（後でQRコード化）
  - 受信したCandidateを`AddIceCandidate()`で追加
  - **完了日**: 2026-02-16

#### データ受信実装

- [x] **Task C-5**: DataChannelでのデータ受信 ✅
  - DataChannelの`onmessage`イベント処理
  - 受信データのデシリアライズ（既存の`ITrackingDataDeserializer`を使用）
  - コンソールへの出力
  - **完了日**: 2026-02-16

- [x] **Task C-6**: 既存Receiverアプリへの統合 ✅
  - `Program.cs`でWebRTCReceiverを起動
  - WebSocketServerと並行動作可能（--mode引数で選択）
  - コマンドライン引数でWebSocket/WebRTCを選択
  - **完了日**: 2026-02-16

---

### Phase 1-D: 統合・検証

#### クリーンアップ

- [x] **Task D-0**: .NET側WebSocket実装の削除 ✅
  - `WebSocketServer.cs`の削除
  - `Program.cs`からWebSocketモードの削除（WebRTC専用化）
  - ビルド確認（警告・エラーなし）
  - 理由: Web側と同様にWebRTC専用に統一
  - **完了日**: 2026-02-16 (コミット bc9bb5e)

#### ローカル検証

- [x] **Task D-1**: ローカル環境での動作確認 ✅
  - PC上でVite dev server起動（HTTP: localhost:3000）
  - .NETアプリ起動
  - ブラウザとPC間でSDP/ICE Candidate手動交換
  - DataChannel接続確立の確認
  - TrackingDataの送受信確認（Readableフォーマットで疎通確認済み）
  - 備考: SIPSorcery生成SDPのブラウザ互換性対応（SDP末尾改行正規化）が必要だった
  - **完了日**: 2026-02-17

- [ ] **Task D-2**: エラーハンドリングの実装
  - Web側: 接続失敗時のエラー表示
  - .NET側: 例外処理とログ出力
  - タイムアウト処理

- [ ] **Task D-3**: ログ出力の整備
  - Web側: コンソールログで接続フロー確認
  - .NET側: コンソール出力で受信データ確認
  - デバッグ用の詳細ログ

#### GitHub Pagesでの検証

- [x] **Task D-4**: GitHub Pagesへのデプロイ ✅
  - ビルド・デプロイ
  - HTTPS環境でのWebRTC動作確認
  - Mixed Content問題が発生しないことを確認
  - **完了日**: 2026-02-17

- [x] **Task D-5**: モバイルからの接続テスト ✅
  - モバイルでGitHub Pagesを開く
  - PC側のOffer SDPをモバイルに入力（手動）
  - モバイルのAnswer SDPをPCに入力（手動）
  - 接続確立・データ送信の確認
  - **完了日**: 2026-02-17

---

## 完了条件

### 必須条件
- [ ] Web側でRTCPeerConnectionとDataChannelが動作
- [ ] .NET側でSIPSorceryを使ったDataChannel受信が動作
- [ ] ローカル環境（HTTP）でDataChannel経由のTrackingData送受信が成功
- [ ] GitHub Pages（HTTPS）でDataChannel経由のTrackingData送受信が成功
- [ ] Mixed Content問題が発生しないことを確認

### オプション条件
- [ ] WebSocketとWebRTCの切り替えUI実装
- [ ] 接続状態の詳細表示
- [ ] 性能測定（レイテンシ、スループット）

---

## 次のフェーズへの移行条件

Phase 1が完了し、以下が確認できたらPhase 2（QRコードペアリング実装）に移行:

1. WebRTC DataChannelの基本動作確認
2. GitHub Pages（HTTPS）からLAN内PC（.NET）への接続成功
3. TrackingDataの送受信が正常に動作
4. Mixed Content問題が発生しないことを確認

---

## 参考資料

- [MDN: WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [SIPSorcery GitHub](https://github.com/sipsorcery-org/sipsorcery)
- [WebRTC Samples](https://webrtc.github.io/samples/)
- [Serverless WebRTC using QR codes](https://franklinta.com/2014/10/19/serverless-webrtc-using-qr-codes/)

---

## 注意事項

- 既存のWebSocket実装は残す（後方互換性のため）
- TrackingDataの型・シリアライザは既存のものを再利用
- QRコード実装はPhase 2で行う（Phase 1では手動入力で代用）
- STUNサーバーは公開サーバー（`stun:stun.l.google.com:19302`）を使用
