# VmmTrackerDataSender プロトコル仕様書

バージョン: 1.0
最終更新: 2026-02-15

## 概要

本プロトコルは、モバイル端末のWebブラウザで実行される顔トラッキングアプリケーションから、PC上の.NETアプリケーションへ、WebSocketを介してトラッキングデータをリアルタイム送信するためのデータフォーマットを定義します。

## 通信方式

- **プロトコル**: WebSocket (RFC 6455)
- **エンドポイント**: `ws://<server-ip>:<port>/` (例: `ws://192.168.1.100:8080/`)
- **接続方向**: Web (クライアント) → .NET (サーバー)
- **メッセージタイプ**: Binary (Compressed形式) または Text (Readable形式)
- **送信頻度**: 任意 (通常はカメラのフレームレート、例: 30fps)

## データ構造

### 送信データの構成

各メッセージには以下の2種類のデータが含まれます:

1. **頭部姿勢 (Head Pose)**
   - 位置 (Position): 3D空間上の座標 (x, y, z)
   - 回転 (Rotation): クォータニオン (x, y, z, w)

2. **ブレンドシェイプ (Blend Shapes)**
   - MediaPipe Face Landmarkerが提供する52個のブレンドシェイプ値
   - 各値は0〜255の整数 (元の0.0〜1.0を255倍してuint8に変換)

## データフォーマット

### 1. Compressed形式 (バイナリ)

高速・低帯域幅用途向けの固定長バイナリフォーマット。

#### バイトレイアウト

| オフセット | サイズ | データ型 | 説明 |
|----------|--------|---------|------|
| 0x00     | 1 byte  | uint8   | Protocol Version (Major) |
| 0x01     | 1 byte  | uint8   | Protocol Version (Minor) |
| 0x02     | 1 byte  | uint8   | Protocol Version (Build/Patch) |
| 0x03     | 1 byte  | uint8   | Reserved (将来の拡張用、現在は0) |
| 0x04     | 4 bytes | float32 | Position X |
| 0x08     | 4 bytes | float32 | Position Y |
| 0x0C     | 4 bytes | float32 | Position Z |
| 0x10     | 4 bytes | float32 | Rotation X (Quaternion) |
| 0x14     | 4 bytes | float32 | Rotation Y (Quaternion) |
| 0x18     | 4 bytes | float32 | Rotation Z (Quaternion) |
| 0x1C     | 4 bytes | float32 | Rotation W (Quaternion) |
| 0x20     | 52 bytes | uint8[52] | BlendShapes[0]〜[51] |
| **合計** | **84 bytes** | - | - |

#### エンディアン

- **リトルエンディアン** (x86/x64, ARM標準)

#### WebSocketメッセージタイプ

- **Binary** (opcode: 0x02)

#### 実装例 (JavaScript送信側)

```javascript
const buffer = new ArrayBuffer(84);
const view = new DataView(buffer);
const uint8View = new Uint8Array(buffer);

// Version (bytes 0-3)
uint8View[0] = 1;  // Major
uint8View[1] = 0;  // Minor
uint8View[2] = 0;  // Build/Patch
uint8View[3] = 0;  // Reserved

// Position (bytes 4-15)
view.setFloat32(4, posX, true);   // true = little-endian
view.setFloat32(8, posY, true);
view.setFloat32(12, posZ, true);

// Rotation (bytes 16-31)
view.setFloat32(16, rotX, true);
view.setFloat32(20, rotY, true);
view.setFloat32(24, rotZ, true);
view.setFloat32(28, rotW, true);

// BlendShapes (bytes 32-83)
for (let i = 0; i < 52; i++) {
    uint8View[32 + i] = blendShapes[i]; // 0-255
}

websocket.send(buffer);
```

#### 実装例 (C#受信側)

```csharp
// Version (bytes 0-3)
byte major = data[0];
byte minor = data[1];
byte build = data[2];
// byte reserved = data[3];

// Position (bytes 4-15)
var px = BitConverter.ToSingle(data, 4);
var py = BitConverter.ToSingle(data, 8);
var pz = BitConverter.ToSingle(data, 12);

// Rotation (bytes 16-31)
var rx = BitConverter.ToSingle(data, 16);
var ry = BitConverter.ToSingle(data, 20);
var rz = BitConverter.ToSingle(data, 24);
var rw = BitConverter.ToSingle(data, 28);

// BlendShapes (bytes 32-83)
byte[] blendShapes = new byte[52];
Array.Copy(data, 32, blendShapes, 0, 52);
```

---

### 2. Readable形式 (JSON)

デバッグ・開発用途向けの可読性の高いテキストフォーマット。

#### JSON構造

```json
{
  "version": "1.0.0",
  "headPose": {
    "px": <float>,
    "py": <float>,
    "pz": <float>,
    "rx": <float>,
    "ry": <float>,
    "rz": <float>,
    "rw": <float>
  },
  "blendShape": {
    "<blend_shape_name_0>": <int 0-255>,
    "<blend_shape_name_1>": <int 0-255>,
    ...
    "<blend_shape_name_51>": <int 0-255>
  }
}
```

#### フィールド説明

- `version`: プロトコルバージョン文字列 (string, 形式: "major.minor.patch")
- `headPose.px/py/pz`: 頭部位置 (float)
- `headPose.rx/ry/rz/rw`: 頭部回転クォータニオン (float)
- `blendShape.<name>`: ブレンドシェイプ値 (int, 0-255)

#### 送信時の最適化

- **Minify推奨**: 改行・インデントを削除してデータサイズを削減
- **精度**: 浮動小数点数は必要十分な桁数に丸める (例: 小数点以下3-4桁)

#### WebSocketメッセージタイプ

- **Text** (opcode: 0x01)
- エンコーディング: **UTF-8**

#### 実装例 (JavaScript送信側)

```javascript
const data = {
  version: "1.0.0",
  headPose: {
    px: 0.123, py: -0.456, pz: 0.789,
    rx: 0.0, ry: 0.0, rz: 0.0, rw: 1.0
  },
  blendShape: {
    eyeBlinkLeft: 128,
    eyeBlinkRight: 130,
    // ... 他50個
  }
};

websocket.send(JSON.stringify(data));
```

---

## 座標系定義

> **注意**: 以下の座標系定義はMediaPipe Face Landmarkerの出力に基づく暫定仕様です。
> 実装時のMediaPipe APIの実際の挙動や、受信側アプリケーション（VRMビューアー等）の要件に応じて、**座標系は変更される可能性があります**。

### 基本座標系

- **座標系タイプ**: 右手座標系（MediaPipe標準）
- **原点**: カメラ位置
- **単位**: メートル（推定）

### 軸定義 (暫定)

- **X軸**: 右方向が正 (カメラから見て右)
- **Y軸**: 下方向が正 (カメラから見て下) ※MediaPipeは画像座標系を使用
- **Z軸**: カメラから遠ざかる方向が正 (奥行き)

### 回転表現

- **形式**: クォータニオン (x, y, z, w)
- **正規化**: 正規化されたクォータニオン (|q| = 1)
- **恒等回転**: (0, 0, 0, 1)

### 座標変換の可能性

実装時に以下のような変換が必要になる可能性があります:

- Y軸の反転 (上向き正への変換)
- 左手座標系への変換 (Unity等の要件)
- スケール調整
- 原点のオフセット

**推奨**: 受信側アプリケーションで座標系変換を行い、送信側は生のMediaPipe座標をそのまま送信する

---

## ブレンドシェイプ仕様

### MediaPipe Face Landmarker BlendShapes

MediaPipe Face Landmarkerは**52個**のARKit互換ブレンドシェイプを提供します。

#### ブレンドシェイプ名と順序

以下の順序でデータを配列に格納します（インデックス0〜51）:

```
0:  browDownLeft
1:  browDownRight
2:  browInnerUp
3:  browOuterUpLeft
4:  browOuterUpRight
5:  cheekPuff
6:  cheekSquintLeft
7:  cheekSquintRight
8:  eyeBlinkLeft
9:  eyeBlinkRight
10: eyeLookDownLeft
11: eyeLookDownRight
12: eyeLookInLeft
13: eyeLookInRight
14: eyeLookOutLeft
15: eyeLookOutRight
16: eyeLookUpLeft
17: eyeLookUpRight
18: eyeSquintLeft
19: eyeSquintRight
20: eyeWideLeft
21: eyeWideRight
22: jawForward
23: jawLeft
24: jawOpen
25: jawRight
26: mouthClose
27: mouthDimpleLeft
28: mouthDimpleRight
29: mouthFrownLeft
30: mouthFrownRight
31: mouthFunnel
32: mouthLeft
33: mouthLowerDownLeft
34: mouthLowerDownRight
35: mouthPressLeft
36: mouthPressRight
37: mouthPucker
38: mouthRight
39: mouthRollLower
40: mouthRollUpper
41: mouthShrugLower
42: mouthShrugUpper
43: mouthSmileLeft
44: mouthSmileRight
45: mouthStretchLeft
46: mouthStretchRight
47: mouthUpperUpLeft
48: mouthUpperUpRight
49: noseSneerLeft
50: noseSneerRight
51: tongueOut
```

#### 値の範囲

- **MediaPipe出力**: 0.0 〜 1.0 (float)
- **送信時**: 0 〜 255 (uint8)
- **変換式**: `uint8_value = round(mediapipe_value * 255)`
- **受信側での復元**: `float_value = uint8_value / 255.0`

#### Readable形式でのキー名

JSON形式では、上記のブレンドシェイプ名をそのままキーとして使用します。

```json
{
  "blendShape": {
    "browDownLeft": 0,
    "browDownRight": 0,
    "browInnerUp": 15,
    "eyeBlinkLeft": 200,
    "eyeBlinkRight": 198,
    "jawOpen": 128,
    ...
  }
}
```

---

## エラーハンドリング

### 受信側の検証

受信側アプリケーションは以下を検証すべきです:

#### Compressed形式
- データサイズが正確に84バイトであること
- プロトコルバージョンが互換性のある範囲内であること
- クォータニオンが正規化されていること（許容誤差あり）
- ブレンドシェイプ値が0〜255の範囲内であること

#### Readable形式
- JSONパース可能であること
- 必須フィールド (`version`, `headPose`, `blendShape`) が存在すること
- バージョン文字列が "major.minor.patch" 形式であること
- 数値型が適切であること

### エラー時の動作

- **不正なデータ**: ログ出力し、そのフレームを破棄（通信は継続）
- **パフォーマンス低下**: フレームスキップ等で対応

---

## バージョニング

### バージョン情報の埋め込み

#### Compressed形式

データの先頭4バイトにプロトコルバージョン情報が埋め込まれています:

- **Byte 0**: Major Version (メジャーバージョン)
- **Byte 1**: Minor Version (マイナーバージョン)
- **Byte 2**: Build/Patch Version (ビルド/パッチバージョン)
- **Byte 3**: Reserved (予約領域、将来の拡張用)

#### Readable形式

JSON構造の `version` フィールドに文字列形式でバージョンが含まれます:

- **形式**: `"major.minor.patch"` (例: `"1.0.0"`)
- **必須**: はい（バージョン1.0.0以降）

### 現在のバージョン

- **プロトコルバージョン**: 1.0.0
- **Compressed形式バージョンフィールド**: `[1, 0, 0, 0]`
- **策定日**: 2026-02-15

### バージョン互換性ルール

受信側アプリケーションは以下のルールでバージョン互換性を判定すべきです:

- **Major Version不一致**: 互換性なし、エラーとして処理
- **Minor Version差**: 後方互換、新機能は無視して処理可能
- **Build/Patch差**: 完全互換、バグ修正のみ

### 将来の拡張

以下の機能追加が検討されています:

- ハンドトラッキングデータの追加 (Major Version 2.x)
- 圧縮アルゴリズムの適用 (Minor Version x.y)
- Reserved領域を利用した拡張フラグ

---

## 参考資料

- [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)
- [ARKit Face Tracking](https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation)
- [WebSocket Protocol (RFC 6455)](https://datatracker.ietf.org/doc/html/rfc6455)
- [IEEE 754 浮動小数点数](https://en.wikipedia.org/wiki/IEEE_754)

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|----------|------|---------|
| 1.0 | 2026-02-15 | 初版作成 |
