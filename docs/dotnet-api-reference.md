# .NET ライブラリ API リファレンス

## プロジェクト構成

| プロジェクト | ターゲット | 役割 |
|---|---|---|
| **VmmTrackerCore** | .NET Standard 2.1 | トラッキングデータモデル、デシリアライザ、SDP圧縮コーデック、シグナリング関連ユーティリティ。WPF / Unity 等から参照可能 |
| **VmmTrackerReceiver** | .NET 8.0 | WebRTC 受信 (SIPSorcery)、AES-GCM 復号実装。コンソールアプリだが、`WebRTCReceiver` 等のクラスは WPF アプリから再利用可能 |

依存関係: `VmmTrackerReceiver` → `VmmTrackerCore`, `SIPSorcery`, `QRCoder`

---

## VmmTrackerCore

### TrackingData / HeadPose

トラッキングデータのモデル。Web 側から送信されるデータの受信結果を表す。

```csharp
public struct HeadPose
{
    public float PositionX, PositionY, PositionZ;       // 頭部位置
    public float RotationX, RotationY, RotationZ, RotationW; // 回転 (Quaternion)
}

public class TrackingData
{
    public HeadPose HeadPose { get; set; }
    public byte[] BlendShapes { get; set; } // 52要素、各0-255
}
```

### ITrackingDataDeserializer

DataChannel から受信したバイナリ/テキストデータを `TrackingData` に変換するインタフェース。

```csharp
public interface ITrackingDataDeserializer
{
    TrackingData Deserialize(byte[] data);   // バイナリ入力
    TrackingData Deserialize(string data);   // テキスト入力
}
```

実装クラス:

| クラス | 対応フォーマット | 主に使うメソッド |
|---|---|---|
| `CompressedDeserializer` | Compressed (バイナリ 84byte固定) | `Deserialize(byte[])` |
| `ReadableDeserializer` | Readable (JSON) | `Deserialize(string)` — `Deserialize(byte[])` は UTF-8 デコード後に委譲 |

**使用例:**

```csharp
ITrackingDataDeserializer deserializer = new CompressedDeserializer();
// または new ReadableDeserializer();

// DataChannel の onmessage で受信した byte[] を渡す
TrackingData data = deserializer.Deserialize(receivedBytes);
Console.WriteLine(data.HeadPose);
```

**注意:**
- `CompressedDeserializer.Deserialize(string)` は `NotSupportedException` をスローする
- フォーマットの選択は起動時に決定し、動的判別は行わない想定

### SdpCodec

WebRTC SDP を QR コード / base64 交換に適したコンパクトバイナリに圧縮・復元する。

```csharp
public static class SdpCodec
{
    // SDP + ICE候補 → コンパクトバイナリ (71-116 bytes)
    static byte[] Encode(string sdp, bool isOffer, string[] iceCandidateLines);

    // コンパクトバイナリ → 復元された SDP テキスト
    static (string sdp, bool isOffer) Decode(byte[] data);
}
```

**バイナリフォーマット:**
`[header:1] [fingerprint:32] [ufrag_len:1] [ufrag:U] [pwd_len:1] [pwd:P] [candidate_count:1] [candidates:var]`

詳細仕様は [`docs/sdp-compression-spec.md`](./sdp-compression-spec.md) を参照。

**使用例:**

```csharp
// Offer SDP の圧縮 (PC → QRコード)
byte[] compressed = SdpCodec.Encode(localSdp, isOffer: true, iceCandidateLines);

// Answer SDP の復元 (モバイルから受信した圧縮バイナリ)
var (sdp, isOffer) = SdpCodec.Decode(answerBytes);
```

### SignalingCrypto

AES-128 鍵およびセッショントークンの生成。

```csharp
public static class SignalingCrypto
{
    static byte[] GenerateKey();      // ランダム AES-128 鍵 (16 bytes)
    static string GenerateToken();    // セッショントークン (UUID v4)
}
```

**注意:** 復号処理は `IAnswerDecryptor` インタフェースで抽象化されている（後述）。

### IAnswerDecryptor

シグナリング API から取得した暗号化 Answer を復号するインタフェース。
復号の具体的な実装（AES-GCM 等）はアプリケーション側で提供する。

```csharp
public interface IAnswerDecryptor
{
    /// <param name="key">AES-128 key (16 bytes)</param>
    /// <param name="encryptedData">IV[12] || ciphertext[N] || authTag[16]</param>
    /// <returns>復号された圧縮 SDP answer</returns>
    byte[] Decrypt(byte[] key, byte[] encryptedData);
}
```

**データレイアウト (Web Crypto API と互換):** `IV[12 bytes] || ciphertext[N bytes] || authTag[16 bytes]`

**設計意図:**
`AesGcm` クラスは .NET Core 3.0+ で利用可能だが、.NET Standard 2.1 の保証 API ではない。
Unity 等のランタイムで `AesGcm` が使えない場合に別の復号実装を差し込めるよう、インタフェースで抽象化している。
WPF アプリでは復号と QR コード表示を WPF 側に移管し、Unity には復号済みデータだけを渡す構成を想定。

### SignalingUrl

QR コード用の URL を組み立てるユーティリティ。

```csharp
public static class SignalingUrl
{
    // フラグメント付き URL を生成: WebBaseUrl#token.base64url(key + offer)
    static string BuildUrl(string token, byte[] aesKey, byte[] compressedOffer);

    static string Base64UrlEncode(byte[] data);   // RFC 4648 §5
    static byte[] Base64UrlDecode(string str);
}
```

**URL 形式:** `https://malaybaku.github.io/VmmTrackerDataSender/#<token>.<base64url(aesKey[16] + compressedOffer[N])>`

### SignalingApiClient

Firebase バックエンド API をポーリングして Answer を取得する。

```csharp
public class SignalingApiClient : IDisposable
{
    // Answer が PUT されるまでポーリング。取得できたら暗号化された base64 文字列を返す
    Task<string> PollForAnswer(
        string token,
        CancellationToken cancellationToken = default,
        int intervalMs = 2000,   // ポーリング間隔
        int timeoutMs = 300000   // タイムアウト (5分)
    );
}
```

### SignalingConfig

シグナリング関連の定数。

```csharp
public static class SignalingConfig
{
    const string ApiBaseUrl;    // Firebase API エンドポイント
    const string WebBaseUrl;    // GitHub Pages URL
    const int AesKeySize = 16;
    const int AesIvSize = 12;
    const int AesTagSize = 16;
    const int PollIntervalMs = 2000;
    const int PollTimeoutMs = 300000;
}
```

---

## VmmTrackerReceiver

### WebRTCReceiver

WebRTC DataChannel の受信側を管理するクラス。SIPSorcery ベース。

```csharp
public class WebRTCReceiver : IDisposable
{
    // コンストラクタ: フォーマットに応じたデシリアライザを渡す
    WebRTCReceiver(ITrackingDataDeserializer deserializer);

    // Offerer として初期化。ICE gathering 完了後に CompressedSdpReady が発火する
    Task InitializeAsOfferer();

    // Answerer として初期化。圧縮 Offer バイナリを渡す
    Task InitializeAsAnswerer(byte[] offerBytes);

    // Offerer 側で使用。モバイルから受け取った圧縮 Answer を設定する
    void SetRemoteAnswer(byte[] answerBytes);

    // 接続確立を待機する (connected / failed / closed まで)
    Task WaitForConnection(CancellationToken cancellationToken = default);

    void Close();
    void Dispose();

    // イベント
    event Action<TrackingData>? DataReceived;           // トラッキングデータ受信
    event Action<string>? ErrorOccurred;                // エラー発生
    event Action<byte[], bool>? CompressedSdpReady;     // 圧縮SDP生成完了 (data, isOffer)
    event Action<RTCPeerConnectionState>? ConnectionStateChanged; // 接続状態変化
}
```

**標準的な使用フロー (Offerer):**

```csharp
using var receiver = new WebRTCReceiver(new CompressedDeserializer());

receiver.DataReceived += (data) => { /* トラッキングデータを処理 */ };

// 1. 圧縮 Offer をキャプチャ
var offerTcs = new TaskCompletionSource<byte[]>();
receiver.CompressedSdpReady += (data, isOffer) =>
{
    if (isOffer) offerTcs.TrySetResult(data);
};

// 2. Offerer として初期化 → ICE gathering → CompressedSdpReady 発火
await receiver.InitializeAsOfferer();
byte[] offerBytes = await offerTcs.Task;

// 3. offerBytes を QR コード等でモバイルに渡す
//    (SignalingUrl.BuildUrl → QR 画像生成)

// 4. モバイルから受け取った圧縮 Answer を設定
receiver.SetRemoteAnswer(answerBytes);

// 5. 接続確立を待機
await receiver.WaitForConnection(cts.Token);
```

### AesGcmAnswerDecryptor

`IAnswerDecryptor` の .NET 8.0 向け実装。`System.Security.Cryptography.AesGcm` を使用。

```csharp
public class AesGcmAnswerDecryptor : IAnswerDecryptor
{
    byte[] Decrypt(byte[] key, byte[] encryptedData);
}
```

**使用例:**

```csharp
IAnswerDecryptor decryptor = new AesGcmAnswerDecryptor();
var encryptedData = Convert.FromBase64String(encryptedBase64);
byte[] answerBytes = decryptor.Decrypt(aesKey, encryptedData);
```

---

## 典型的な統合フロー

以下は `Program.cs` の `RunAutoSignaling` が実装しているフローの概要。WPF アプリへの組み込み時もこの流れを踏襲する。

```
1. SignalingCrypto.GenerateKey()     → aesKey
2. SignalingCrypto.GenerateToken()   → token
3. WebRTCReceiver.InitializeAsOfferer()  → CompressedSdpReady で offerBytes を取得
4. SignalingUrl.BuildUrl(token, aesKey, offerBytes)  → QR コード用 URL
5. QR コードを UI に表示 (PngByteQRCode 等)
6. SignalingApiClient.PollForAnswer(token)  → encryptedBase64
7. IAnswerDecryptor.Decrypt(aesKey, encryptedData)  → answerBytes
8. WebRTCReceiver.SetRemoteAnswer(answerBytes)
9. WebRTCReceiver.WaitForConnection()
10. DataReceived イベントでトラッキングデータを受信
```

**WPF + Unity 構成での分担例:**

| ステップ | WPF 側 | Unity 側 |
|---|---|---|
| 1-6 | シグナリング全般（鍵生成、QR表示、API ポーリング） | — |
| 7 | `AesGcmAnswerDecryptor` で復号 | — |
| 8-9 | WebRTC 接続確立 | — |
| 10 | `TrackingData` を Unity に転送 | `TrackingData` を受け取って利用 |
