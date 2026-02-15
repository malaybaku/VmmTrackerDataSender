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

## フェーズ2': 動画ファイル対応（デバッグ効率化）

**目的**: カメラを毎回起動せず、同じ条件で繰り返しテストできるようにする

### タスク
- [ ] 動画ソース選択UIの追加
- [ ] ファイル選択機能の実装
- [ ] test-data/sample-face.mp4 の直接読み込み機能
- [ ] videoエレメントへの動画セット

### 実装内容
```typescript
// HTML追加
<select id="video-source">
  <option value="camera">カメラ</option>
  <option value="file">動画ファイル選択</option>
  <option value="test-data">テストデータ (test-data/sample-face.mp4)</option>
</select>
<input type="file" id="video-file-input" accept="video/*" style="display:none" />

// TypeScript実装
async function startVideoSource() {
  const source = videoSourceSelect.value;

  if (source === 'camera') {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 1280, height: 720 }
    });
    video.srcObject = stream;
  } else if (source === 'file') {
    videoFileInput.style.display = 'block';
    videoFileInput.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        video.src = URL.createObjectURL(file);
        video.loop = true; // デバッグ用にループ再生
        video.play();
      }
    };
    videoFileInput.click();
  } else if (source === 'test-data') {
    video.src = './test-data/sample.mp4';  // 利用可能: 顔を隠す時間帯あり（トラッキングロステスト用）
    video.loop = true;
    video.play();
  }
}
```

### 期待される結果
- カメラ、ファイル選択、テストデータの3つから選択可能
- 動画ファイルが正常に再生される
- ループ再生で連続テストが可能

### デバッグポイント
- 動画ファイルのコーデック互換性（H.264推奨）
- ファイルパスの解決（Viteのpublic/ディレクトリまたは相対パス）
- 動画の自動再生ポリシー（ユーザーインタラクション後に再生）

### メリット
- ✅ 開発イテレーションが高速化
- ✅ 再現性の高いテスト
- ✅ カメラ権限を毎回取得する必要がない
- ✅ 同じ映像で値を検証できる

**利用可能なテストデータ**:
- `test-data/sample.mp4` が利用可能（顔を隠す時間帯を含む。トラッキングロス時の動作確認用）

**注意**: test-data/フォルダには各自で顔が映った動画を追加配置できます（gitignore対象）

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
4. **フェーズ2'**: 動画ファイル対応（20分）← **デバッグ効率化のため早めに実装推奨**
5. **フェーズ3**: MediaPipeセットアップ（30分〜1時間）← 最も時間がかかる可能性
6. **フェーズ4**: BlendShape取得（30分）
7. **フェーズ5**: 頭部姿勢計算（30分〜1時間）
8. **フェーズ6**: Readable形式（30分）
9. **フェーズ7**: Compressed形式（30分）
10. **フェーズ8**: 統合（15分）
11. **フェーズ9-10**: 改善・テスト（状況に応じて）

**合計見積もり**: 4.5〜6.5時間（デバッグ時間を含む）

---

## 今後のタスク（実装済み機能の検証・改善）

### 四元数→オイラー角変換処理を.NET側に実装

**目的**: 受信した四元数データが正しいか検証するため、.NET側でリファレンス実装を用意する

**実装内容**:
- [ ] VmmTrackerCore に四元数→オイラー角変換のユーティリティクラス/メソッドを追加
- [ ] デシリアライズの延長として、受信データを人間が理解しやすいオイラー角（Pitch, Yaw, Roll）に変換
- [ ] VmmTrackerReceiver のコンソール出力で、四元数とオイラー角の両方を表示
- [ ] 変換アルゴリズムは標準的な数学的変換を使用（例: Yaw-Pitch-Roll順序）

**検証方法**:
- 実機で頭を動かして、オイラー角の値が直感的に正しいか確認
  - 頭を左右に振る → Yaw が変化
  - 頭を上下に傾ける → Pitch が変化
  - 頭を左右に傾ける → Roll が変化
- Web側のMediaPipe変換行列→四元数変換が正しいか検証

**参考**:
- MediaPipe の変換行列は列優先（column-major）形式
- 位置成分: matrix[12], matrix[13], matrix[14]
- 座標系の定義は protocol.md に記載済み

**優先度**: 中（Web実装は完了済み、データ検証のため実施）
