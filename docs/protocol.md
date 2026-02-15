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
| 0x00     | 4 bytes | float32 | Position X |
| 0x04     | 4 bytes | float32 | Position Y |
| 0x08     | 4 bytes | float32 | Position Z |
| 0x0C     | 4 bytes | float32 | Rotation X (Quaternion) |
| 0x10     | 4 bytes | float32 | Rotation Y (Quaternion) |
| 0x14     | 4 bytes | float32 | Rotation Z (Quaternion) |
| 0x18     | 4 bytes | float32 | Rotation W (Quaternion) |
| 0x1C     | 52 bytes | uint8[52] | BlendShapes[0]〜[51] |
| **合計** | **80 bytes** | - | - |

#### エンディアン

- **リトルエンディアン** (x86/x64, ARM標準)
- JavaScriptの`DataView`およびC#の`BitConverter`はプラットフォームのネイティブエンディアンを使用

#### WebSocketメッセージタイプ

- **Binary** (opcode: 0x02)

#### 実装例 (JavaScript送信側)

```javascript
const buffer = new ArrayBuffer(80);
const view = new DataView(buffer);

// Position (bytes 0-11)
view.setFloat32(0, posX, true);  // true = little-endian
view.setFloat32(4, posY, true);
view.setFloat32(8, posZ, true);

// Rotation (bytes 12-27)
view.setFloat32(12, rotX, true);
view.setFloat32(16, rotY, true);
view.setFloat32(20, rotZ, true);
view.setFloat32(24, rotW, true);

// BlendShapes (bytes 28-79)
const uint8View = new Uint8Array(buffer);
for (let i = 0; i < 52; i++) {
    uint8View[28 + i] = blendShapes[i]; // 0-255
}

websocket.send(buffer);
```

#### 実装例 (C#受信側)

```csharp
var px = BitConverter.ToSingle(data, 0);
var py = BitConverter.ToSingle(data, 4);
var pz = BitConverter.ToSingle(data, 8);
var rx = BitConverter.ToSingle(data, 12);
var ry = BitConverter.ToSingle(data, 16);
var rz = BitConverter.ToSingle(data, 20);
var rw = BitConverter.ToSingle(data, 24);

byte[] blendShapes = new byte[52];
Array.Copy(data, 28, blendShapes, 0, 52);
```

---

### 2. Readable形式 (JSON)

デバッグ・開発用途向けの可読性の高いテキストフォーマット。

#### JSON構造

```json
{
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
- データサイズが正確に80バイトであること
- クォータニオンが正規化されていること（許容誤差あり）
- ブレンドシェイプ値が0〜255の範囲内であること

#### Readable形式
- JSONパース可能であること
- 必須フィールド (`headPose`, `blendShape`) が存在すること
- 数値型が適切であること

### エラー時の動作

- **不正なデータ**: ログ出力し、そのフレームを破棄
- **WebSocket切断**: 再接続待機状態に遷移
- **パフォーマンス低下**: フレームスキップ等で対応

---

## バージョニング

### 現在のバージョン

- **プロトコルバージョン**: 1.0
- **策定日**: 2026-02-15

### 将来の拡張

以下の機能追加が検討されています:

- ハンドトラッキングデータの追加
- 複数フォーマットの自動判別
- 圧縮アルゴリズムの適用
- バージョン情報のヘッダー追加

### 後方互換性

フォーマット変更時は以下を考慮します:

- メジャーバージョン変更: 非互換な変更
- マイナーバージョン変更: 後方互換な機能追加
- パッチバージョン: ドキュメント修正・明確化

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
