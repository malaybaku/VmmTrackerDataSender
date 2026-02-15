# Webアプリケーション - プレビューモード実装計画

## 目的

デバッグ効率向上のため、映像プレビュー表示を4つのモードから選択できるようにする。

---

## プレビューモード仕様

### モードA: ステータスのみ

**表示内容:**
- トラッキング状態を3種類で表示
  - ✅ **トラッキング成功** (緑色)
  - ⚠️ **処理中・顔未検出** (黄色)
  - ❌ **トラッキング未実行** (灰色)

**UI:**
- 大きなステータスアイコン + テキスト
- 背景色で状態を視覚的に表現

---

### モードB: ステータス + 数値データ

**表示内容:**
- モードAの内容
- **頭部位置**: x, y, z (cm単位、小数第一位まで)
- **頭部姿勢**: Pitch, Yaw, Roll (度数法、小数第一位まで)

**UI例:**
```
✅ トラッキング成功

位置 (cm):
  X: 12.3
  Y: -5.7
  Z: 45.2

姿勢 (度):
  Pitch: 15.3° (上下)
  Yaw:   -8.5° (左右)
  Roll:   2.1° (傾き)
```

---

### モードC: ステータス + 数値 + ランドマーク描画

**表示内容:**
- モードBの内容
- **Face Landmark**: 顔の特徴点をCanvas上に描画
  - MediaPipeが検出した468個の特徴点
  - 映像の上にオーバーレイ表示

**UI:**
- 上半分: Canvas（映像 + ランドマーク描画）
- 下半分: ステータス + 数値データ

---

### モードD: 映像そのもの

**表示内容:**
- 現在と同じ、映像をそのまま表示
- `<video>`要素の直接表示

---

## UI設計

### プレビューモード選択

**配置場所:** 映像エリアの上部または下部

**UI要素:**
```html
<select id="preview-mode-select">
  <option value="status-only">A: ステータスのみ</option>
  <option value="status-data">B: ステータス + 数値</option>
  <option value="status-data-landmarks">C: ステータス + 数値 + ランドマーク</option>
  <option value="video-raw">D: 映像そのもの</option>
</select>
```

### 表示エリアの構成

```html
<div id="video-container">
  <!-- モードDで表示 -->
  <video id="video"></video>

  <!-- モードA, B, Cで表示 -->
  <canvas id="preview-canvas"></canvas>

  <!-- モードA, B, Cのテキストオーバーレイ -->
  <div id="preview-overlay">
    <!-- ステータス、数値データを表示 -->
  </div>
</div>
```

---

## タスクリスト

### フェーズ1: 型定義と基盤整備

- [ ] **Task 1-1**: `types.ts`にPreviewMode enumを追加
  ```typescript
  export enum PreviewMode {
    StatusOnly = 'status-only',
    StatusData = 'status-data',
    StatusDataLandmarks = 'status-data-landmarks',
    VideoRaw = 'video-raw'
  }
  ```

- [ ] **Task 1-2**: `types.ts`にTrackingStatus enumを追加
  ```typescript
  export enum TrackingStatus {
    NotTracking = 'not-tracking',
    TrackingNoFace = 'tracking-no-face',
    TrackingSuccess = 'tracking-success'
  }
  ```

- [ ] **Task 1-3**: `types.ts`にEulerAngles型を追加
  ```typescript
  export interface EulerAngles {
    pitch: number; // 度数法
    yaw: number;
    roll: number;
  }
  ```

**期待結果**: 型定義が整備される

---

### フェーズ2: 数学ユーティリティの実装

- [ ] **Task 2-1**: `src/utils/math.ts`を作成
  - Quaternion → Euler角変換関数を実装
  - 度数法（degrees）への変換関数を実装
  - cm単位への変換（MediaPipeの座標系に応じて）

- [ ] **Task 2-2**: 変換関数の実装
  ```typescript
  export function quaternionToEuler(quat: {x,y,z,w}): EulerAngles
  export function radToDeg(rad: number): number
  export function formatFloat(val: number, decimals: number): string
  ```

**期待結果**: 数学的変換関数が利用可能

---

### フェーズ3: MediaPipeManagerの拡張

- [ ] **Task 3-1**: トラッキング状態の通知機能を追加
  - `onTrackingStatus: (status: TrackingStatus) => void`イベントを追加
  - フレーム処理時に状態を判定して通知

- [ ] **Task 3-2**: Face Landmarkデータの通知機能を追加
  - `onLandmarks: (landmarks: NormalizedLandmark[]) => void`イベントを追加
  - MediaPipeの468個の特徴点を通知

**期待結果**: MediaPipeManagerがトラッキング状態とランドマークを通知

---

### フェーズ4: プレビューレンダラーの実装

- [ ] **Task 4-1**: `src/previewRenderer.ts`を作成
  - PreviewRendererクラスを実装
  - Canvas要素とオーバーレイDIVを管理

- [ ] **Task 4-2**: モードA - ステータスのみ表示
  - `renderStatusOnly(status: TrackingStatus): void`
  - 大きなアイコン + テキスト表示
  - 背景色の変更

- [ ] **Task 4-3**: モードB - ステータス + 数値データ
  - `renderStatusData(status, headPose, euler): void`
  - モードAの内容 + 位置・姿勢の数値表示

- [ ] **Task 4-4**: モードC - ステータス + 数値 + ランドマーク
  - `renderStatusDataLandmarks(status, headPose, euler, landmarks, video): void`
  - Canvasに映像を描画
  - 468個のランドマークを点で描画
  - オーバーレイにステータス + 数値表示

- [ ] **Task 4-5**: モードD - 映像そのもの
  - `renderVideoRaw(): void`
  - Canvasを非表示、video要素を表示

**期待結果**: 各モードのレンダリング機能が完成

---

### フェーズ5: UI統合

- [ ] **Task 5-1**: `index.html`にプレビューモード選択UIを追加
  - `<select id="preview-mode-select">`の追加
  - `<canvas id="preview-canvas">`の追加
  - `<div id="preview-overlay">`の追加

- [ ] **Task 5-2**: CSSスタイルの追加
  - Canvas、オーバーレイのレイアウト
  - ステータス表示のスタイル（色、フォント）
  - レスポンシブ対応

- [ ] **Task 5-3**: `main.ts`にプレビューモード切り替え処理を追加
  - `preview-mode-select`のchangeイベントリスナー
  - PreviewRendererインスタンスの作成
  - モード切り替え時の表示更新

**期待結果**: UIからプレビューモードを選択可能

---

### フェーズ6: イベント配線と状態管理

- [ ] **Task 6-1**: MediaPipeManagerのイベントを接続
  - `onTrackingStatus` → PreviewRendererに通知
  - `onLandmarks` → PreviewRendererに通知
  - `onTrackingData` → 位置・姿勢データを保持

- [ ] **Task 6-2**: フレームごとのレンダリング
  - `requestAnimationFrame`でCanvas更新（モードCのみ）
  - モードA, Bはイベント駆動で更新

- [ ] **Task 6-3**: 状態管理の整理
  - 現在のプレビューモード
  - 最新のトラッキングデータ
  - 最新のランドマークデータ

**期待結果**: リアルタイムでプレビューが更新される

---

### フェーズ7: デバッグモード対応

- [ ] **Task 7-1**: デバッグモード時のプレビュー表示
  - デバッグ動画読み込み時も各モードで表示可能
  - localStorage等でプレビューモード設定を保存（オプション）

**期待結果**: デバッグモードでもプレビューが正常動作

---

### フェーズ8: テスト・検証

- [ ] **Task 8-1**: 各モードの動作確認
  - モードAでステータス表示が正しい
  - モードBで数値データが正しい
  - モードCでランドマークが正しく描画される
  - モードDで映像が表示される

- [ ] **Task 8-2**: パフォーマンス確認
  - モードCでフレームレートが維持される
  - Canvas描画のパフォーマンス最適化

- [ ] **Task 8-3**: エラーハンドリング
  - トラッキング失敗時の表示
  - モード切り替え時のクリーンアップ

**期待結果**: すべてのモードが安定動作

---

## 実装の注意点

### 1. Quaternion → Euler角の変換

- MediaPipeの座標系を考慮
- Yaw-Pitch-Roll順序（一般的な順序）
- Gimbal Lockの考慮（必要に応じて）

参考実装:
```typescript
function quaternionToEuler(q: {x,y,z,w}): EulerAngles {
  // Yaw (Y軸回転)
  const sinYaw = 2 * (q.w * q.y - q.z * q.x);
  const cosYaw = 1 - 2 * (q.x * q.x + q.y * q.y);
  const yaw = Math.atan2(sinYaw, cosYaw);

  // Pitch (X軸回転)
  const sinPitch = 2 * (q.w * q.x + q.y * q.z);
  const pitch = Math.asin(Math.max(-1, Math.min(1, sinPitch)));

  // Roll (Z軸回転)
  const sinRoll = 2 * (q.w * q.z - q.x * q.y);
  const cosRoll = 1 - 2 * (q.y * q.y + q.z * q.z);
  const roll = Math.atan2(sinRoll, cosRoll);

  return {
    pitch: radToDeg(pitch),
    yaw: radToDeg(yaw),
    roll: radToDeg(roll)
  };
}
```

### 2. Canvas描画のパフォーマンス

- `requestAnimationFrame`を使用
- 不要な再描画を避ける
- オフスクリーンCanvasの検討（必要に応じて）

### 3. 座標系の変換

- MediaPipeの正規化座標 (0-1) → Canvas座標 (px)
- 必要に応じてcm単位への変換係数を調整

### 4. UI/UXの考慮

- モード切り替えは即座に反映
- トラッキング状態の色分けを視認性高く
- モバイル対応（レスポンシブレイアウト）

---

## 完了条件

- [ ] すべてのタスクが完了
- [ ] 4つのプレビューモードがすべて動作
- [ ] 型チェックが通る
- [ ] ビルドが通る
- [ ] 既存機能（WebSocket送信等）に影響なし
- [ ] パフォーマンスが維持される（30fps以上）

---

## リファレンス

### MediaPipe Face Landmarker

- 468個の3D顔特徴点
- 正規化座標 (x, y, z: 0-1の範囲)
- BlendShapes: 52個

### 座標系

- MediaPipeの座標系: 右手系、Y軸が下向き
- 変換が必要な場合は適宜調整

---

## 優先度

### 必須 (MVP)
- フェーズ1-6: 基本機能の実装

### 推奨
- フェーズ7: デバッグモード対応
- フェーズ8: テスト・検証

### オプション
- localStorage設定保存
- オフスクリーンCanvas最適化
- ランドマークの接続線描画（顔の輪郭等）
