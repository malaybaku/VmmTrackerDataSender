# WebRTC DataChannel PoC - フェーズ1 調査結果

## 調査日
2026-02-16

---

## 1. WebRTC DataChannel API仕様

### 基本概念

**RTCPeerConnection**
- WebRTC接続の中核となるAPI
- P2P接続の確立・管理を担当
- SDP（Session Description Protocol）による接続情報の交換

**RTCDataChannel**
- P2P間でのバイナリ・テキストデータの送受信
- DTLS（Datagram TLS）で自動的に暗号化される
- 低レイテンシ、高スループット

**接続確立フロー**
1. Offer側: `createOffer()` でSDP Offerを生成
2. Offer側: `setLocalDescription()` でローカルに設定
3. Answer側: `setRemoteDescription()` でOfferを受信
4. Answer側: `createAnswer()` でSDP Answerを生成
5. Answer側: `setLocalDescription()` でローカルに設定
6. Offer側: `setRemoteDescription()` でAnswerを受信
7. ICE Candidateの交換
8. P2P接続確立

### 参考資料
- [MDN: Using WebRTC data channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels)
- [WebRTC connectivity - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity)

---

## 2. SDP（Session Description Protocol）のデータサイズ

### 典型的なサイズ

**最小構成:**
- 基本SDP（メディアなし）: 約84バイト
- 2つのICE Candidateを含む場合: 約290バイト

**実用的な構成:**
- DataChannelのみ（複数ICE Candidate含む）: **500〜1,500バイト**
- 音声・映像を含む場合: **1,500〜3,000バイト以上**

**構成要素:**
- セッション情報（v=, o=, s=, t=）
- 接続情報（c=）
- メディア記述（m=, a=）
- ICE Candidates（a=candidate）
- DTLS証明書フィンガープリント（a=fingerprint）
- コーデック情報（a=rtpmap, a=fmtp）

### サイズに影響する要因
1. ICE Candidateの数（ネットワーク環境により3〜10個程度）
2. メディアタイプ（DataChannelのみ vs 音声・映像）
3. コーデックオプション
4. RTPヘッダ拡張

### 参考資料
- [Anatomy of a WebRTC SDP - webrtcHacks](https://webrtchacks.com/sdp-anatomy/)
- [The Minimum Viable SDP - webrtcHacks](https://webrtchacks.com/the-minimum-viable-sdp/)
- [WebRTC SDP Internals - Dyte](https://dyte.io/blog/webrtc-sdp-internals/)

---

## 3. QRコードの容量とSDP圧縮

### QRコードの最大容量

| Version | モジュール数 | バイナリモード（Low EC） | 英数字モード（Low EC） |
|---------|------------|------------------------|---------------------|
| Version 10 | 57x57 | 468バイト | 395文字 |
| Version 20 | 97x97 | 1,273バイト | 1,071文字 |
| Version 30 | 137x137 | 2,132バイト | 1,795文字 |
| **Version 40** | **177x177** | **2,953バイト** | **2,488文字** |

**注意:**
- 上記はエラー訂正レベルL（Low）の場合
- エラー訂正レベルを上げると容量が減少
  - M（Medium）: 約15%減
  - Q（Quartile）: 約25%減
  - H（High）: 約30%減

### 典型的なSDPとQRコード容量の比較

| データ | サイズ | QRコード Version | 可否 |
|--------|--------|-----------------|------|
| 最小SDP | 84バイト | Version 4 | ✅ 余裕 |
| DataChannel SDP | 500〜1,500バイト | Version 20〜30 | ✅ 可能 |
| フルSDP（音声・映像） | 2,000〜3,000バイト | Version 40 | ⚠️ ギリギリ |

**問題点:**
- Version 30以上のQRコードはスキャンに時間がかかる（1秒以上）
- 複数のICE Candidateを含むと容量を超える可能性

### SDP圧縮技術: QWBP

**QWBP (QR-WebRTC Bootstrap Protocol):**
- SDPを2,500バイトから**55バイトに圧縮**（97.79%削減）
- Version 4 QRコード（最小サイズ）で収まる
- スキャン時間: 500ms未満
- DataChannelのみの場合に最適化

**圧縮手法:**
- セマンティックレイヤーでの圧縮（意味を理解した上で圧縮）
- 不要な情報の削除
- バイナリプロトコルでのエンコード
- 両端のエンドポイントを制御する前提

**制約:**
- DataChannelのみ（音声・映像は非対応）
- カスタムバイナリプロトコル実装が必要
- 両端が同じプロトコルを理解する必要

### 参考資料
- [QR Code Information Capacity - DENSO WAVE](https://www.qrcode.com/en/about/version.html)
- [QR Code Storage Capacity Guide - QRCodeChimp](https://www.qrcodechimp.com/qr-code-storage-capacity-guide/)
- [Breaking the QR Limit: QWBP - magarcia.io](https://magarcia.io/air-gapped-webrtc-breaking-the-qr-limit/)

---

## 4. 推奨アプローチ

### PoC（Phase 1）での方針

**手動入力方式（QRコード前）:**
- SDP OfferとAnswerをテキストエリアで表示・入力
- Base64エンコードで扱いやすくする
- ICE Candidateも同様に手動交換

**データサイズ対策は後回し:**
- Phase 1では圧縮なしの標準SDPを使用
- Phase 2でQRコード化する際に圧縮を検討

### Phase 2以降の方針

**選択肢1: 標準SDP + Version 20〜30 QRコード**
- 実装が簡単
- QRコードサイズが大きい（スキャン時間が長い）

**選択肢2: QWBP準拠の圧縮実装**
- QRコードサイズが小さい（Version 4で収まる）
- スキャン時間が短い（500ms未満）
- カスタム実装が必要（複雑）

**推奨: まずは選択肢1で実装、必要に応じて選択肢2を検討**

---

## 5. SIPSorceryライブラリ

### 概要

**SIPSorcery:**
- フルC#実装のWebRTC、SIP、VoIPライブラリ
- .NET用の純粋なC#実装（ネイティブラッパー不要）
- AGPL制約なし（2026年1月以降）
- クロスプラットフォーム（Windows、Linux、macOS）

### DataChannelサポート

**RTCDataChannel API:**
- `Send(string message)`: テキストメッセージ送信
- `Send(byte[] data)`: バイナリデータ送信
- `onmessage`: データ受信イベント
- `onopen`, `onclose`, `onerror`: 状態変更イベント

### サンプルコード

**リポジトリ:**
- [SIPSorcery GitHub](https://github.com/sipsorcery-org/sipsorcery)
- [DataChannel HTMLサンプル](https://github.com/sipsorcery-org/sipsorcery/blob/master/examples/WebRTCExamples/WebRTCGetStartedDataChannel/datachannel.html)

**ドキュメント:**
- [SIPSorcery公式ガイド](https://sipsorcery-org.github.io/sipsorcery/)
- [RTCDataChannel APIリファレンス](https://sipsorcery-org.github.io/sipsorcery/api/SIPSorcery.Net.RTCDataChannel.html)

### NuGetインストール

```bash
dotnet add package SIPSorcery
```

現在の最新版: 10.0.3（2026年2月時点）

### 参考資料
- [SIPSorcery GitHub Repository](https://github.com/sipsorcery-org/sipsorcery)
- [SIPSorcery Guide and Reference](https://sipsorcery-org.github.io/sipsorcery/)
- [How to Build SipSorcery WebRTC App with C#](https://www.videosdk.live/developer-hub/media-server/sipsorcery-webrtc)

---

## 6. QRコードライブラリ

### Web側（JavaScript/TypeScript）

**推奨: qrcode（node-qrcode）**
- npmパッケージ: `qrcode`
- ブラウザ対応: ✅（Webpack/Vite経由）
- 出力形式: Canvas、SVG、Data URL、Raw Image
- 軽量、依存なし
- TypeScript型定義あり

**インストール:**
```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

**代替候補:**
- `QRCode.js` (davidshimjs): シンプル、依存なし
- `qr-code-styling`: スタイリング機能が豊富

### .NET側（C#）

**推奨: QRCoder**
- NuGetパッケージ: `QRCoder`
- 依存ライブラリ: なし
- 生成速度: 高速（約592ms）
- .NET Framework、.NET Core、.NET Standard対応

**インストール:**
```bash
dotnet add package QRCoder
```

**代替候補:**
- `ZXing.Net`: 読み取りと生成の両対応、クロスプラットフォーム
- `IronQR`: 商用ライブラリ（有料）

### QRコード読み取り（スキャン）

**Web側:**
- `html5-qrcode`: Webカメラからのスキャン
- `jsQR`: Canvas画像からのデコード

**.NET側:**
- `ZXing.Net`: 画像からのデコード
- `QRCoder`も読み取り機能あり（要確認）

### 参考資料
- [qrcode - npm](https://www.npmjs.com/package/qrcode)
- [QRCode.js GitHub](https://github.com/davidshimjs/qrcodejs)
- [QRCoder - NuGet](https://www.nuget.org/packages/qrcoder/)
- [ZXing.Net GitHub](https://github.com/micjahn/ZXing.Net)

---

## 7. データフォーマット設計

### 既存実装の再利用

**TrackingData型:**
```typescript
export interface TrackingData {
  headPose: HeadPose;
  blendShape: BlendShapeData;
}
```

**シリアライザ:**
- `serializeCompressed()`: バイナリ形式
- `serializeReadable()`: JSON形式

**再利用方針:**
- WebRTC DataChannel経由でも同じ`TrackingData`型を使用
- 既存のシリアライザをそのまま利用
- フォーマット選択（compressed/readable）も維持

### DataChannel送信形式

**Binaryモード（compressed）:**
```typescript
const buffer = serializeCompressed(trackingData);
dataChannel.send(buffer);
```

**Textモード（readable）:**
```typescript
const json = serializeReadable(trackingData);
dataChannel.send(json);
```

### .NET側の受信

**既存デシリアライザの再利用:**
```csharp
// Binary
var trackingData = compressedDeserializer.Deserialize(binaryData);

// JSON
var trackingData = readableDeserializer.Deserialize(jsonText);
```

---

## 8. STUNサーバー設定

### 必要性

**STUN（Session Traversal Utilities for NAT）:**
- NAT越えのためにパブリックIPアドレスを取得
- ICE Candidateの収集に必要
- LAN内通信でも推奨（ファイアウォール対策）

### 推奨STUNサーバー

**Google公開STUNサーバー:**
```javascript
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};
const peerConnection = new RTCPeerConnection(configuration);
```

**その他の公開STUNサーバー:**
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`
- `stun:stun.stunprotocol.org:3478`

### TURNサーバー

**Phase 1では不要:**
- LAN内通信なので直接P2P接続可能
- TURNはリレーサーバー（NAT越えが厳しい場合に使用）

---

## 9. 実装推奨事項

### Phase 1での優先順位

1. **最優先**: WebRTC基本機能の動作確認
   - RTCPeerConnection、RTCDataChannel
   - SDP手動交換でのP2P接続確立
   - TrackingDataの送受信

2. **次点**: エラーハンドリングとログ
   - 接続失敗時の適切なエラー表示
   - 接続フロー全体のログ出力

3. **後回し**: UI/UX改善
   - QRコード化（Phase 2）
   - 自動再接続
   - 接続状態の詳細表示

### 技術的な注意点

**HTTPS環境でのテスト:**
- GitHub PagesでのテストでMixed Content問題が発生しないことを確認
- WebRTC接続はDTLS暗号化されているため、HTTPS→WebRTCは許可される

**STUN/TURNサーバーアクセス:**
- 公開STUNサーバーへのアクセスはHTTPS環境から可能
- Mixed Content問題は発生しない

**DataChannelのバッファリング:**
- 大量データ送信時のバッファオーバーフロー対策
- `bufferedAmount`のチェック

---

## 10. まとめ

### QRコードのデータサイズ結論

**標準SDP（圧縮なし）:**
- DataChannelのみ: 500〜1,500バイト
- QRコード Version 20〜30が必要
- スキャン時間: 1〜2秒

**QWBP圧縮SDP:**
- 圧縮後: 55バイト
- QRコード Version 4で収まる
- スキャン時間: 500ms未満
- **実装が複雑、カスタムプロトコルが必要**

**推奨:**
- Phase 1では標準SDPを使用（手動入力）
- Phase 2でQRコード化する際に、標準SDPをまず試す
- スキャン時間が問題になればQWBP圧縮を検討

### 次のステップ

Phase 1-B（Web側実装）に進む準備が整いました:
1. SIPSorceryの基本的な使い方は理解
2. QRコードライブラリは選定済み（後で実装）
3. データフォーマットは既存のものを再利用
4. STUNサーバーは公開サーバーを使用

---

## 参考文献

- [MDN: Using WebRTC data channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels)
- [Anatomy of a WebRTC SDP - webrtcHacks](https://webrtchacks.com/sdp-anatomy/)
- [Breaking the QR Limit: QWBP](https://magarcia.io/air-gapped-webrtc-breaking-the-qr-limit/)
- [SIPSorcery GitHub](https://github.com/sipsorcery-org/sipsorcery)
- [qrcode - npm](https://www.npmjs.com/package/qrcode)
- [QRCoder - NuGet](https://www.nuget.org/packages/qrcoder/)
