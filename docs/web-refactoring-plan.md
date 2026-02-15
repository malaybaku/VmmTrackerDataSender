# Web アプリケーション リファクタリング計画

## 目的

`main.ts`（約560行）を責務ごとにモジュール分割し、保守性・テスタビリティを向上させる。

**重要**: リファクタリング中も既存の動作を完全に維持すること。

---

## ファイル構成（After）

```
web/src/
├── main.ts                      # エントリーポイント（UI初期化、イベント配線のみ）
├── types.ts                     # データ構造の型定義
├── videoSource.ts               # 映像ソース管理（カメラ/動画ファイル）
├── mediapipe.ts                 # MediaPipe管理（初期化、トラッキング）
├── websocket.ts                 # WebSocket管理（接続、送信）
├── ui.ts                        # UI状態管理（ボタン制御、ステータス表示）
├── serializers/
│   ├── index.ts                 # シリアライザーのエクスポート
│   ├── readableSerializer.ts    # Readable形式（JSON）
│   └── compressedSerializer.ts  # Compressed形式（Binary）
└── debug.ts                     # デバッグモード（開発環境専用）
```

---

## タスクリスト

### フェーズ1: 型定義の分離

- [x] **Task 1-1**: `src/types.ts` を作成
  - `VideoSourceState` enum を定義
  - `HeadPose` 型を定義
  - `BlendShapeData` 型を定義
  - `TrackingData` 型を定義
  - `SerializationFormat` 型を定義 (`'readable' | 'compressed'`)

- [x] **Task 1-2**: `main.ts` から型定義をインポート
  - `VideoSourceState` の定義を削除し、`types.ts` からインポート
  - 動作確認（ビルドが通ること）

**期待結果**: ビルドが通り、既存の動作が維持される

---

### フェーズ2: データシリアライザーの分離

- [x] **Task 2-1**: `src/serializers/readableSerializer.ts` を作成
  - `serializeReadable()` 関数を移動
  - 必要な型を `types.ts` からインポート
  - エクスポート: `export function serializeReadable(...): string`

- [x] **Task 2-2**: `src/serializers/compressedSerializer.ts` を作成
  - `serializeCompressed()` 関数を移動
  - 必要な型を `types.ts` からインポート
  - エクスポート: `export function serializeCompressed(...): ArrayBuffer`

- [x] **Task 2-3**: `src/serializers/index.ts` を作成
  - 両方のシリアライザーを再エクスポート
  ```typescript
  export { serializeReadable } from './readableSerializer';
  export { serializeCompressed } from './compressedSerializer';
  ```

- [x] **Task 2-4**: `main.ts` から関数を削除し、インポートに置き換え
  - `sendReadableFormat()` と `sendCompressedFormat()` を更新
  - 動作確認（データ送信が正常に動作すること）

**期待結果**: WebSocketでデータが正常に送信される

---

### フェーズ3: WebSocket管理の分離

- [x] **Task 3-1**: `src/websocket.ts` を作成
  - WebSocket接続状態を管理するクラス `WebSocketManager` を実装
  - メソッド:
    - `connect(url: string): Promise<void>`
    - `disconnect(): void`
    - `send(data: string | ArrayBuffer): void`
    - `isConnected(): boolean`
  - イベント:
    - `onOpen: () => void`
    - `onClose: () => void`
    - `onError: (error: Event) => void`

- [x] **Task 3-2**: `sendTrackingData()` 関数を `WebSocketManager` に統合
  - シリアライザーを呼び出してデータを送信
  - フォーマット選択ロジックを含める

- [x] **Task 3-3**: `main.ts` を更新
  - WebSocket関連のグローバル変数を削除
  - `WebSocketManager` インスタンスを使用
  - Connect/Disconnectボタンのイベントハンドラーを更新
  - 動作確認（接続/切断/送信が正常に動作すること）

**期待結果**: WebSocket接続・切断・データ送信が正常に動作する

---

### フェーズ4: 映像ソース管理の分離

- [x] **Task 4-1**: `src/videoSource.ts` を作成
  - 映像ソース状態を管理するクラス `VideoSourceManager` を実装
  - プロパティ:
    - `state: VideoSourceState`
    - `videoElement: HTMLVideoElement`
  - メソッド:
    - `startCamera(): Promise<void>`
    - `startVideoFile(file: File): Promise<void>`
    - `restartVideo(): Promise<void>`
    - `stop(): void`
    - `pause(): void`
  - イベント:
    - `onStateChange: (newState: VideoSourceState) => void`

- [x] **Task 4-2**: `stopVideoSource()` ヘルパー関数を統合

- [x] **Task 4-3**: `main.ts` を更新
  - 映像ソース関連のグローバル変数を削除
  - `VideoSourceManager` インスタンスを使用
  - ボタンイベントハンドラーを簡素化
  - 動作確認（カメラ/動画ファイルの起動/停止が正常に動作すること）

**期待結果**: カメラ起動、動画ファイル選択、停止が正常に動作する

---

### フェーズ5: MediaPipe管理の分離

- [x] **Task 5-1**: `src/mediapipe.ts` を作成
  - MediaPipeを管理するクラス `MediaPipeManager` を実装
  - メソッド:
    - `initialize(): Promise<void>`
    - `startTracking(videoElement: HTMLVideoElement): void`
    - `stopTracking(): void`
    - `isInitialized(): boolean`
  - イベント:
    - `onTrackingData: (data: TrackingData) => void`

- [x] **Task 5-2**: 以下の関数を移動
  - `initializeMediaPipe()`
  - `startTracking()`
  - `stopTracking()`
  - `processVideoFrame()`
  - `matrixToQuaternion()`

- [x] **Task 5-3**: `main.ts` を更新
  - MediaPipe関連のグローバル変数を削除
  - `MediaPipeManager` インスタンスを使用
  - トラッキングデータを受け取って `WebSocketManager` に送信
  - 動作確認（トラッキングが正常に動作すること）

**期待結果**: 顔トラッキングが正常に動作し、データが送信される

---

### フェーズ6: UI管理の分離

- [x] **Task 6-1**: `src/ui.ts` を作成
  - UI状態を管理するクラス `UIManager` を実装
  - メソッド:
    - `updateButtonStates(state: VideoSourceState): void`
    - `updateStatus(message: string, type: 'normal' | 'connected' | 'error'): void`
    - `setConnectButtonText(text: string): void`

- [x] **Task 6-2**: 以下の関数を移動
  - `updateStatus()`
  - `updateButtonStates()`
  - `setVideoSourceState()`

- [x] **Task 6-3**: `main.ts` を更新
  - `UIManager` インスタンスを使用
  - 動作確認（ボタンの有効/無効切り替え、ステータス表示が正常に動作すること）

**期待結果**: UI状態が正常に更新される

---

### フェーズ7: デバッグモードの分離

- [x] **Task 7-1**: `src/debug.ts` を作成
  - `autoStartDebugMode()` 関数を移動
  - 必要な依存関係（VideoSourceManager, WebSocketManager, MediaPipeManager）を受け取る

- [x] **Task 7-2**: `main.ts` を更新
  - デバッグモード関数をインポート
  - 初期化時に呼び出し
  - 動作確認（デバッグモードが正常に動作すること）

**期待結果**: デバッグ動画の自動読み込みが正常に動作する

---

### フェーズ8: main.tsのクリーンアップ

- [x] **Task 8-1**: `main.ts` を整理
  - グローバル変数をすべて削除（各マネージャーのインスタンスのみ残す）
  - UI要素の取得
  - 各マネージャーのインスタンス作成
  - イベントハンドラーの配線（ボタンクリック等）
  - デバッグモードの呼び出し

- [x] **Task 8-2**: 最終確認
  - すべての機能が正常に動作すること
  - ビルドが通ること
  - コンソールエラーがないこと

**期待結果**: main.tsが214行（コメント含む）に収まり、見通しが良くなる

---

## 実装の注意点

### 1. 段階的リファクタリング
- 各フェーズごとに動作確認を行う
- 1つのフェーズが完了してから次に進む
- 問題が発生したらすぐに元に戻せるようにする

### 2. 既存の動作を維持
- リファクタリング中も既存の動作を100%維持する
- デバッグモードも含めて全機能をテスト

### 3. 型安全性
- TypeScriptの型を活用して、リファクタリング時の誤りを防ぐ
- `any` 型は使わない

### 4. 依存関係の方向
```
main.ts
  ↓ (depends on)
ui.ts, debug.ts
  ↓
videoSource.ts, mediapipe.ts, websocket.ts
  ↓
serializers/, types.ts
```

- 循環依存を避ける
- 下位レイヤーは上位レイヤーに依存しない

---

## 完了条件

- [x] すべてのタスクが完了している
- [x] ビルドが通る（`npm run build`）
- [x] 型チェックが通る（`npm run type-check`）
- [x] 開発サーバーで正常に動作する（`npm run dev`）
- [x] 以下の機能がすべて動作する:
  - カメラ起動
  - 動画ファイル選択
  - 動画再起動
  - トラッキング停止
  - WebSocket接続/切断
  - Readable/Compressedフォーマット切り替え
  - デバッグモード（開発環境）

---

## リファクタリング後の効果

### メリット
1. **保守性向上**: 各モジュールの責務が明確
2. **テスタビリティ向上**: 各モジュールを独立してテスト可能
3. **可読性向上**: main.tsが簡潔になり、全体の流れが把握しやすい
4. **拡張性向上**: 新機能追加時に影響範囲が限定される

### デメリット
- ファイル数が増える（1ファイル → 約10ファイル）
- モジュール間の依存関係管理が必要

**総評**: デメリットを大きく上回るメリットがあり、長期的な保守性が向上する。
