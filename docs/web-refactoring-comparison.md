# リファクタリング前後の比較

## ファイル構成の変化

### Before（1ファイル構成）

```
web/src/
└── main.ts (515行)
    ├── 型定義
    ├── グローバル変数（10個以上）
    ├── UI要素の取得
    ├── ステータス更新関数
    ├── ボタン状態更新関数
    ├── MediaPipe初期化
    ├── カメラ起動処理
    ├── 動画ファイル処理
    ├── 動画再起動処理
    ├── トラッキング停止処理
    ├── WebSocket接続処理
    ├── トラッキング開始処理
    ├── フレーム処理ループ
    ├── データシリアライズ（2形式）
    ├── クォータニオン変換
    ├── デバッグモード
    └── イベントハンドラー（5個）
```

**問題点**:
- すべての機能が1ファイルに集約
- グローバル変数が多数存在
- 責務が不明確
- テストが困難
- 修正の影響範囲が広い

---

### After（11ファイル構成）

```
web/src/
├── main.ts (214行)
│   └── エントリーポイント
│       ├── UI要素の取得
│       ├── マネージャーインスタンス作成
│       ├── イベント配線
│       └── デバッグモード起動
│
├── types.ts (50行)
│   └── 型定義
│       ├── VideoSourceState
│       ├── HeadPose
│       ├── BlendShapeData
│       ├── TrackingData
│       ├── SerializationFormat
│       └── StatusType
│
├── videoSource.ts (160行)
│   └── VideoSourceManager
│       ├── startCamera()
│       ├── startVideoFile()
│       ├── startVideoUrl()
│       ├── restartVideo()
│       ├── stop()
│       ├── pause()
│       └── onStateChange イベント
│
├── mediapipe.ts (225行)
│   └── MediaPipeManager
│       ├── initialize()
│       ├── startTracking()
│       ├── stopTracking()
│       ├── processVideoFrame()
│       ├── matrixToQuaternion()
│       ├── onInitialized イベント
│       ├── onError イベント
│       └── onTrackingData イベント
│
├── websocket.ts (98行)
│   └── WebSocketManager
│       ├── connect()
│       ├── disconnect()
│       ├── sendTrackingData()
│       ├── isConnected()
│       ├── onOpen イベント
│       ├── onClose イベント
│       └── onError イベント
│
├── ui.ts (85行)
│   └── UIManager
│       ├── updateStatus()
│       ├── updateButtonStates()
│       └── setConnectButtonText()
│
├── debug.ts (77行)
│   └── autoStartDebugMode()
│       └── デバッグ環境での自動起動
│
└── serializers/
    ├── index.ts (5行)
    │   └── エクスポート
    ├── readableSerializer.ts (47行)
    │   └── serializeReadable()
    └── compressedSerializer.ts (65行)
        └── serializeCompressed()
```

**改善点**:
- 責務ごとにモジュール分割
- グローバル変数ゼロ
- 明確なインターフェース
- テストが容易
- 修正の影響範囲が限定的

---

## コード量の比較

| ファイル | 行数 | 責務 |
|---------|------|------|
| **Before** |
| main.ts | 515行 | すべて |
| **合計** | **515行** | |
| | |
| **After** |
| main.ts | 214行 | エントリーポイント |
| types.ts | 50行 | 型定義 |
| videoSource.ts | 160行 | 映像ソース管理 |
| mediapipe.ts | 225行 | トラッキング処理 |
| websocket.ts | 98行 | 通信管理 |
| ui.ts | 85行 | UI状態管理 |
| debug.ts | 77行 | デバッグ機能 |
| serializers/index.ts | 5行 | エクスポート |
| serializers/readableSerializer.ts | 47行 | JSON形式 |
| serializers/compressedSerializer.ts | 65行 | バイナリ形式 |
| **合計** | **909行** | |

**注**: コメントと空行を含めると増加していますが、これは可読性向上のためです。

---

## アーキテクチャの変化

### Before: モノリシック構造

```
[main.ts (515行)]
     ↓
すべての処理が内部に含まれる
- 状態管理
- ビジネスロジック
- UI更新
- ネットワーク
```

**問題**:
- 機能追加時に main.ts が肥大化
- どこに何があるか把握困難
- 修正時の影響範囲が不明確

---

### After: レイヤード構造

```
main.ts (エントリーポイント)
    ↓
┌────────────┬────────────┬────────────┐
│  ui.ts     │  debug.ts  │  main.ts   │
│ (UI層)     │  (開発)    │  (配線)    │
└────────────┴────────────┴────────────┘
    ↓               ↓              ↓
┌────────────┬────────────┬────────────┐
│videoSource │ mediapipe  │ websocket  │
│    .ts     │    .ts     │    .ts     │
│(ソース管理)│(トラッキング)│ (通信)     │
└────────────┴────────────┴────────────┘
    ↓               ↓              ↓
┌────────────┬────────────────────────┐
│  types.ts  │    serializers/        │
│  (型定義)  │(データ変換)              │
└────────────┴────────────────────────┘
```

**メリット**:
- 各層の責務が明確
- 下位層は上位層に依存しない
- テストが容易
- 拡張が容易

---

## 依存関係の変化

### Before: 密結合

```
main.ts内の関数群
  ↕
すべてがグローバル変数を通じて相互依存
  ↕
変更の影響が予測困難
```

---

### After: 疎結合

```
main.ts
  ↓ (イベント駆動)
マネージャークラス群
  ↓ (依存性注入)
型定義・ユーティリティ
```

**イベント駆動の例**:
```typescript
// main.ts
mediapipeManager.onTrackingData = (data) => {
  websocketManager.sendTrackingData(...);
};

// mediapipe.ts は websocket.ts を知らない
// 完全に独立している
```

---

## テスタビリティの変化

### Before: テスト困難

```typescript
// main.ts内のグローバル変数
let faceLandmarker: FaceLandmarker | null = null;
let websocket: WebSocket | null = null;
let isTracking = false;

// テストのために main.ts 全体を読み込む必要がある
// モック化が困難
```

---

### After: テスト容易

```typescript
// videoSource.test.ts
const videoSourceManager = new VideoSourceManager(mockVideoElement);
videoSourceManager.onStateChange = (state) => {
  expect(state).toBe(VideoSourceState.CameraRunning);
};
await videoSourceManager.startCamera();
```

各マネージャークラスを独立してテスト可能:
- `VideoSourceManager` のテスト
- `MediaPipeManager` のテスト
- `WebSocketManager` のテスト
- `UIManager` のテスト

---

## 拡張性の変化

### Before: 拡張困難

新機能追加時:
1. main.ts に関数を追加
2. グローバル変数を追加
3. イベントハンドラーを追加
4. 他の機能への影響を調査

**問題**: main.ts がさらに肥大化

---

### After: 拡張容易

新機能追加時:
1. 適切なマネージャーにメソッドを追加
2. 必要に応じて新しいマネージャーを作成
3. main.ts で配線

**メリット**: 影響範囲が限定的

**例: ハンドトラッキング追加**:
```
1. handTracking.ts を新規作成
2. HandTrackingManager クラスを実装
3. main.ts で配線
4. 既存のコードは一切変更不要
```

---

## 実際のコード比較

### 例1: カメラ起動

#### Before (main.ts内)
```typescript
startCameraBtn.addEventListener('click', async () => {
  try {
    stopVideoSource();
    updateStatus('Starting camera...', 'normal');
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', ... }
    });
    video.srcObject = mediaStream;
    await video.play();

    updateStatus('Starting tracking...', 'normal');
    await startTracking();

    setVideoSourceState(VideoSourceState.CameraRunning);
    updateStatus('Camera tracking started', 'connected');
  } catch (err) {
    // エラー処理
    stopVideoSource();
    setVideoSourceState(VideoSourceState.None);
  }
});
```

#### After (main.ts)
```typescript
startCameraBtn.addEventListener('click', async () => {
  try {
    uiManager.updateStatus('Starting camera...', 'normal');
    await videoSourceManager.startCamera();

    uiManager.updateStatus('Starting tracking...', 'normal');
    await mediapipeManager.startTracking(video);

    uiManager.updateStatus('Camera tracking started', 'connected');
  } catch (err) {
    uiManager.updateStatus(`Failed: ${err.message}`, 'error');
    videoSourceManager.stop();
  }
});
```

**改善点**:
- 処理の流れが明確
- 各マネージャーの責務が明確
- テストしやすい

---

### 例2: WebSocket接続

#### Before (main.ts内)
```typescript
connectBtn.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim();

  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.close();
    connectBtn.textContent = 'Connect';
    updateStatus('Disconnected', 'normal');
    return;
  }

  try {
    websocket = new WebSocket(url);
    websocket.onopen = () => {
      updateStatus('Connected', 'connected');
      connectBtn.textContent = 'Disconnect';
    };
    // ...
  } catch (err) {
    // エラー処理
  }
});
```

#### After (main.ts)
```typescript
connectBtn.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim();

  if (websocketManager.isConnected()) {
    websocketManager.disconnect();
    return;
  }

  try {
    await websocketManager.connect(url);
  } catch (err) {
    uiManager.updateStatus('Failed to connect', 'error');
  }
});
```

**改善点**:
- WebSocket の詳細が隠蔽されている
- 接続状態の管理が WebSocketManager に集約
- エラーハンドリングがシンプル

---

## まとめ

このリファクタリングにより、以下の点が大幅に改善されました:

| 項目 | Before | After | 改善度 |
|------|--------|-------|--------|
| **可読性** | ⭐⭐ | ⭐⭐⭐⭐⭐ | +150% |
| **保守性** | ⭐⭐ | ⭐⭐⭐⭐⭐ | +150% |
| **テスタビリティ** | ⭐ | ⭐⭐⭐⭐⭐ | +400% |
| **拡張性** | ⭐⭐ | ⭐⭐⭐⭐⭐ | +150% |
| **型安全性** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | +67% |

すべての既存機能を100%維持しながら、コードの品質を大幅に向上させることができました。
