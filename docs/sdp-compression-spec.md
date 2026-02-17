# SDP圧縮プロトコル仕様 (Phase 2-A)

## 概要

WebRTC DataChannelのシグナリング（SDP交換）をQRコード/base64テキストで行うため、SDPを小さなバイナリに圧縮するプロトコル。現在のSDP（400-600byte）を71-116byte程度に圧縮し、QR Version 5-7に収める。

## 方針

- **HKDF不採用**: ICE credential (ufrag/pwd) は直接送信。SDP mungingが不要でシンプル。
- **Vanilla ICE前提**: ICE候補をすべて収集してからエンコード。
- **LAN限定**: host候補のみ送信（srflx/relay候補はフィルタ）。
- **IPv4/IPv6両対応**: 候補ごとにフラグで識別。

---

## バイナリフォーマット

```
Offset  Size    Field
------  ------  ------------------------------------------
0       1       ヘッダバイト
                  bit 7-5: プロトコルバージョン (現在=0)
                  bit 4:   SDPタイプ (0=offer, 1=answer)
                  bit 3-0: 予約 (0)
1       32      DTLSフィンガープリント (SHA-256 raw binary)
33      1       ufrag長 (U)
34      U       ufrag (UTF-8)
34+U    1       pwd長 (P)
35+U    P       pwd (UTF-8)
35+U+P  1       ICE候補数 (N)
36+U+P  var     候補[0] .. 候補[N-1]

各ICE候補:
  0     1       フラグ (bit 0: 0=IPv4, 1=IPv6)
  1     4|16    IPアドレス (IPv4=4byte, IPv6=16byte)
  +0    2       ポート (big-endian uint16)
```

### ヘッダバイト

| ビット | 意味 |
|--------|------|
| 7-5 | プロトコルバージョン (0-7)。現在 = 0 |
| 4 | SDPタイプ。0 = offer, 1 = answer |
| 3-0 | 予約。0固定 |

バージョン0では、offerは `0x00`、answerは `0x10` となる。SDPテキスト（`v=` で始まる）と区別可能。

### DTLSフィンガープリント

SDPの `a=fingerprint:sha-256 XX:XX:XX:...` からhex colonを32byteのraw binaryに変換。

### ICE credential

ufrag/pwdはUTF-8文字列として長さプレフィクス付きで格納。SIPSorceryのデフォルトはufrag=4文字、pwd=24文字。

### ICE候補

各候補のフラグバイトのbit 0で、IPv4 (4byte) かIPv6 (16byte) かを判別。ポートはbig-endianのuint16。

**フィルタ**: `typ host` の候補のみ対象。srflx/relay候補は除外。

---

## サイズ見積もり

SIPSorceryデフォルト (ufrag=4文字, pwd=24文字) の場合:

| シナリオ | サイズ | QR Version (EC Level L) |
|---|---|---|
| IPv4×1 | 71 byte | Version 5 (154byte) |
| IPv4×2 | 78 byte | Version 5 |
| IPv4×1 + IPv6×1 | 90 byte | Version 5 |
| IPv4×2 + IPv6×2 | 116 byte | Version 7 (230byte) |

base64エンコード後は約4/3倍（95-155文字程度）。

---

## SDP復元テンプレート

デコード時、以下のテンプレートに抽出フィールドを埋め込んで完全なSDPを復元する。

```
v=0\r\n
o=- 0 0 IN IP4 0.0.0.0\r\n
s=-\r\n
t=0 0\r\n
a=group:BUNDLE 0\r\n
m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n
c=IN IP4 0.0.0.0\r\n
a=mid:0\r\n
a=ice-ufrag:{ufrag}\r\n
a=ice-pwd:{pwd}\r\n
a=fingerprint:sha-256 {hex:colon:fingerprint}\r\n
a=setup:{setup_value}\r\n
a=sctp-port:5000\r\n
a=max-message-size:262144\r\n
a=candidate:{foundation} 1 udp {priority} {ip} {port} typ host generation 0\r\n
...（候補の数だけ繰り返し）
```

### 復元ルール

- **setup**: offer → `actpass`, answer → `active`
- **candidate priority**: `(126 << 24) | ((65535 - i) << 8) | 255` (i = 候補インデックス、0始まり)
- **candidate foundation**: 連番 (`1`, `2`, `3`, ...)
- **`a=ice-options` は含めない**: Vanilla ICEのためtrickle表記を避ける

---

## エンコード手順

1. SDPテキストから以下を正規表現で抽出:
   - `a=fingerprint:sha-256 (.+)` → hex colonをバイト配列に変換
   - `a=ice-ufrag:(.+)` → UTF-8文字列
   - `a=ice-pwd:(.+)` → UTF-8文字列
2. ICE候補行 (`a=candidate:` で始まる行) から `typ host` のもののみ抽出し、IP/ポートを解析
3. ヘッダバイトを構築（バージョン + SDPタイプ）
4. バイナリパケットを組み立て

## デコード手順

1. ヘッダバイトからバージョン・SDPタイプを読み取り
2. 32byteフィンガープリントを読み取り → hex colon形式に変換
3. ufrag/pwdを長さプレフィクス付きで読み取り
4. 候補数を読み取り、各候補のフラグ・IP・ポートを読み取り
5. SDPテンプレートにフィールドを埋め込んで完全なSDP文字列を生成

---

## ブラウザ / SIPSorcery 互換性

| 項目 | 注意点 |
|------|--------|
| 改行コード | Chrome は `\r\n` 必須。復元テンプレートで保証 |
| `a=sctp-port:5000` | Chrome が必要とする。必ず含める |
| `a=max-message-size:262144` | Chrome が必要とする。必ず含める |
| `generation 0` | SIPSorcery の候補パーサーが期待する |
| candidate foundation | 連番で問題なし（リモート側ではvalidationされない） |
| `a=ice-options:ice2,trickle` | 復元SDPには含めない（Vanilla ICE） |
| `a=group:BUNDLE 0` | Chrome (Unified Plan) が必要とする |

---

## 実装ファイル

### TypeScript (Web側)
- **新規**: `web/src/sdp-codec.ts`
  - `encodeSdp(sdp: string, type: 'offer' | 'answer', iceCandidates: RTCIceCandidate[]): Uint8Array`
  - `decodeSdp(data: Uint8Array): { sdp: string, type: 'offer' | 'answer' }`
  - `toBase64(data: Uint8Array): string` / `fromBase64(str: string): Uint8Array`
- 参考パターン: `web/src/serializers/compressedSerializer.ts` (DataView/Uint8Array)

### C# (.NET側)
- **新規**: `dotnet/VmmTrackerReceiver/SdpCodec.cs`
  - `static byte[] Encode(string sdp, bool isOffer, string[] iceCandidateLines)`
  - `static (string sdp, RTCSdpType type) Decode(byte[] data)`
  - `static string ToBase64(byte[] data)` / `static byte[] FromBase64(string str)`
- 参考パターン: `dotnet/VmmTrackerCore/CompressedDeserializer.cs` (BitConverter)

---

## 検証方法

1. **ユニットレベル**: 既知のSDP → エンコード → デコード → 復元SDPの必須フィールドが一致
2. **相互運用**: Web側エンコード → .NET側デコード（逆も同様）
3. **base64ラウンドトリップ**: バイナリ → base64 → バイナリが一致
4. **テストベクター**: 固定入力に対する期待バイナリ出力を定義

---

## 将来の拡張可能性

- **HKDF導出**: フィンガープリントからufrag/pwdを導出し、さらに~28byte圧縮（41-86byte）
- **圧縮アルゴリズム**: deflate等の汎用圧縮の追加適用
- **ハンドトラッキング対応**: プロトコルバージョンを上げてフィールド追加
