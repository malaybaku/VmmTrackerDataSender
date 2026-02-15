# Web実装計画

## 実装の段階的アプローチ

MediaPipe統合は複雑なため、以下の段階に分けて実装します。各段階で動作確認を行い、問題を早期発見します。

---

## フェーズ0: 環境セットアップと動作確認

### タスク
- [ ] npm installの実行
- [ ] 開発サーバーの起動確認 (`npm run dev`)
- [ ] ブラウザでの表示確認
- [ ] TypeScriptのビルド確認

### 期待される結果
- http://localhost:3000 でUIが表示される
- カメラ開始ボタン、接続ボタンが表示される
- コンソールにエラーがない

### デバッグポイント
- Viteの設定が正しいか
- TypeScriptのコンパイルエラーがないか

---

## フェーズ1: WebSocket接続のテスト

### タスク
- [ ] .NET受信側アプリを起動
- [ ] WebSocket接続処理の実装確認
- [ ] ダミーデータ（JSON）の送信テスト

### 実装内容
```typescript
// ダミーデータ送信
const testData = {
  version: "1.0.0",
  headPose: { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, rw: 1 },
  blendShape: { eyeBlinkLeft: 128, eyeBlinkRight: 128, /* ... */ }
};
websocket.send(JSON.stringify(testData));
```

### 期待される結果
- .NET側でダミーデータが受信・表示される
- 接続状態が正常に表示される

### デバッグポイント
- WebSocketのURL形式が正しいか
- CORSエラーが発生していないか
- .NET側でデータが正しくデシリアライズされるか

---

## フェーズ2: カメラアクセスの実装

### タスク
- [ ] カメラ起動処理の実装
- [ ] videoエレメントへのストリーム表示
- [ ] カメラ権限のエラーハンドリング

### 実装内容
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'user', width: 1280, height: 720 }
});
video.srcObject = stream;
```

### 期待される結果
- カメラ映像がvideoエレメントに表示される
- モバイルでも動作する

### デバッグポイント
- HTTPS環境でないとカメラアクセスできない（開発時はlocalhostなら問題ない）
- モバイルでの権限ダイアログ

---

## フェーズ3: MediaPipeのセットアップ

### タスク
- [ ] @mediapipe/tasks-visionのインストール確認
- [ ] Face Landmarkerモデルファイルの配置
- [ ] Face Landmarkerの初期化
- [ ] 初期化エラーのハンドリング

### 実装内容
```typescript
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);

const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
    delegate: "GPU"
  },
  outputFaceBlendshapes: true,
  outputFacialTransformationMatrixes: true,
  runningMode: "VIDEO",
  numFaces: 1
});
```

### 期待される結果
- MediaPipeが正常にロードされる
- モデルファイルがダウンロードされる
- 初期化が完了する（数秒かかる可能性あり）

### デバッグポイント
- CDNからのモデルダウンロード失敗
- WebAssemblyのロードエラー
- GPU delegateが使えない環境での対応

---

## フェーズ4: 顔検出とBlendShape取得

### タスク
- [ ] videoフレームのキャプチャ
- [ ] Face Landmarkerでの推論実行
- [ ] BlendShape値の取得
- [ ] コンソールへのログ出力（デバッグ用）

### 実装内容
```typescript
function processVideoFrame() {
  const results = faceLandmarker.detectForVideo(video, performance.now());

  if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
    const blendshapes = results.faceBlendshapes[0].categories;
    console.log('BlendShapes:', blendshapes);
  }

  requestAnimationFrame(processVideoFrame);
}
```

### 期待される結果
- 顔が検出される
- BlendShape値（52個）が取得できる
- 値が0.0〜1.0の範囲である

### デバッグポイント
- 顔が検出されない場合の対処
- パフォーマンス（FPS）の確認
- BlendShape名と順序の確認

---

## フェーズ5: 頭部姿勢の計算

### タスク
- [ ] Facial Transformation Matrixの取得
- [ ] Matrixから位置情報の抽出
- [ ] Matrixから回転（クォータニオン）の計算
- [ ] 座標系の確認と必要に応じた変換

### 実装内容
```typescript
if (results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
  const matrix = results.facialTransformationMatrixes[0].data;

  // Position (translation)
  const px = matrix[3];
  const py = matrix[7];
  const pz = matrix[11];

  // Rotation (matrix to quaternion conversion)
  const quaternion = matrixToQuaternion(matrix);
}
```

### 期待される結果
- 位置と回転が取得できる
- 頭を動かすと値が変化する

### デバッグポイント
- Matrix to Quaternion変換の正確性
- 座標系の確認（MediaPipeの座標系 vs プロトコル仕様）
- スケールの妥当性

---

## フェーズ6: データシリアライズ（Readable形式）

### タスク
- [ ] BlendShapeの0-1 → 0-255変換
- [ ] JSON形式でのシリアライズ
- [ ] バージョン情報の埋め込み
- [ ] BlendShape名のマッピング

### 実装内容
```typescript
function serializeReadable(headPose, blendShapes) {
  const blendShapeObj = {};
  blendShapes.forEach((bs, index) => {
    blendShapeObj[bs.categoryName] = Math.round(bs.score * 255);
  });

  return JSON.stringify({
    version: "1.0.0",
    headPose: {
      px: headPose.px,
      py: headPose.py,
      pz: headPose.pz,
      rx: headPose.rx,
      ry: headPose.ry,
      rz: headPose.rz,
      rw: headPose.rw
    },
    blendShape: blendShapeObj
  });
}
```

### 期待される結果
- JSON形式でデータが生成される
- .NET側で正しくデシリアライズされる

### デバッグポイント
- BlendShape名の順序がプロトコル仕様と一致するか
- 値の範囲チェック（0-255）

---

## フェーズ7: データシリアライズ（Compressed形式）

### タスク
- [ ] ArrayBufferの作成（84 bytes）
- [ ] バージョン情報の書き込み（4 bytes）
- [ ] 頭部姿勢の書き込み（28 bytes）
- [ ] BlendShapesの書き込み（52 bytes）
- [ ] エンディアンの確認

### 実装内容
```typescript
function serializeCompressed(headPose, blendShapes) {
  const buffer = new ArrayBuffer(84);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  // Version
  uint8View[0] = 1; // Major
  uint8View[1] = 0; // Minor
  uint8View[2] = 0; // Patch
  uint8View[3] = 0; // Reserved

  // Position
  view.setFloat32(4, headPose.px, true);
  view.setFloat32(8, headPose.py, true);
  view.setFloat32(12, headPose.pz, true);

  // Rotation
  view.setFloat32(16, headPose.rx, true);
  view.setFloat32(20, headPose.ry, true);
  view.setFloat32(24, headPose.rz, true);
  view.setFloat32(28, headPose.rw, true);

  // BlendShapes
  for (let i = 0; i < 52; i++) {
    uint8View[32 + i] = Math.round(blendShapes[i].score * 255);
  }

  return buffer;
}
```

### 期待される結果
- 84バイトのバイナリデータが生成される
- .NET側で正しくデシリアライズされる

### デバッグポイント
- バイトオーダー（リトルエンディアン）
- オフセット計算のミス
- BlendShapeの順序

---

## フェーズ8: WebSocket送信の統合

### タスク
- [ ] シリアライズとWebSocket送信の統合
- [ ] フォーマット選択の実装
- [ ] 送信頻度の制御（フレームレート調整）
- [ ] エラーハンドリング

### 実装内容
```typescript
function sendTrackingData(headPose, blendShapes) {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) {
    return;
  }

  const format = formatSelect.value;

  if (format === 'readable') {
    const data = serializeReadable(headPose, blendShapes);
    websocket.send(data);
  } else {
    const data = serializeCompressed(headPose, blendShapes);
    websocket.send(data);
  }
}
```

### 期待される結果
- リアルタイムでデータが送信される
- .NET側でデータが受信・表示される
- フォーマット切り替えが機能する

### デバッグポイント
- 送信頻度が高すぎないか（30fps程度が目安）
- バッファオーバーフロー
- 再接続処理

---

## フェーズ9: UI/UX改善

### タスク
- [ ] FPSカウンター表示
- [ ] 送信データのプレビュー表示
- [ ] エラーメッセージの改善
- [ ] モバイル対応の確認
- [ ] パフォーマンス最適化

### 実装内容
- FPSカウンター
- BlendShape値のリアルタイム表示（デバッグ用）
- 接続状態の視覚的フィードバック

### 期待される結果
- ユーザーが状態を理解しやすいUI
- モバイルで快適に動作

---

## フェーズ10: 最終テストとドキュメント更新

### タスク
- [ ] 複数ブラウザでのテスト（Chrome, Safari, Edge）
- [ ] モバイルブラウザでのテスト（iOS Safari, Android Chrome）
- [ ] 長時間動作テスト（メモリリーク確認）
- [ ] web/README.mdの更新（使用方法、トラブルシューティング）

### 期待される結果
- 安定して動作する
- ドキュメントが整備される

---

## 実装の優先順位

### 必須（MVP）
- フェーズ0〜8: 基本機能の実装

### 推奨
- フェーズ9: UI/UX改善

### オプション
- フェーズ10: 広範なテスト

---

## リスク管理

### 想定される問題と対策

| 問題 | 対策 |
|------|------|
| MediaPipeのロード失敗 | CDN障害時のフォールバック、ローカルホスティング検討 |
| モバイルでのパフォーマンス低下 | GPU delegateの使用、解像度の調整、フレームレート制限 |
| 座標系の不一致 | プロトコル仕様で「暫定」と明記済み、受信側で変換可能 |
| BlendShape順序の不一致 | プロトコル仕様書と照合、ユニットテスト作成 |

---

## 推奨実装順序

1. **フェーズ0**: 環境確認（5分）
2. **フェーズ1**: WebSocket接続（15分）
3. **フェーズ2**: カメラアクセス（15分）
4. **フェーズ3**: MediaPipeセットアップ（30分〜1時間）← 最も時間がかかる可能性
5. **フェーズ4**: BlendShape取得（30分）
6. **フェーズ5**: 頭部姿勢計算（30分〜1時間）
7. **フェーズ6**: Readable形式（30分）
8. **フェーズ7**: Compressed形式（30分）
9. **フェーズ8**: 統合（15分）
10. **フェーズ9-10**: 改善・テスト（状況に応じて）

**合計見積もり**: 4〜6時間（デバッグ時間を含む）
