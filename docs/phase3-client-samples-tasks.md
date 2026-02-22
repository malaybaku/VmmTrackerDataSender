# Phase 3: WPF/Unityクライアントサンプル - タスクリスト

## 目的

コンソールアプリ以外のクライアント実装サンプルを提供する。

- **WPFサンプル**: QRコード表示UIの整備が主目的。WPFアプリでシグナリング→WebRTC接続→データ受信の一連のフローを実装
- **Unityサンプル**: VmmTrackerCore.dll + WebRTC を使い、コンソールアプリとほぼ同等に動作するサンプル (QRコード生成は除く)

---

## 設計方針

- WebRTCReceiver と AesGcmAnswerDecryptor を VmmTrackerReceiver (Exe) から新ライブラリ `VmmTrackerWebRtc` に抽出し、WPFとコンソールの両方から参照
- WPF は code-behind ベース (サンプルアプリなので MVVM は採用しない)
- Unity 6 (.NET Standard 2.1) 対象。DLL は手動配置
- Unity側のWebRTC実装は com.unity.webrtc パッケージ or SIPSorceryソース移植の2案を調査し決定
- Unityサンプルはコンソールアプリと同等のフロー（シグナリング→WebRTC接続→データ受信表示）を実装。QRコード生成のみ省略しURL文字列表示で代替
- WPF→Unity の IPC は VMagicMirror 本体の責務でありスコープ外

---

## 進捗サマリー

- **Phase 3-A (フォルダ構造の見直し)**: ✅ 完了 (4/4タスク)
- **Phase 3-B (WPFサンプルアプリ)**: ✅ 完了 (6/6タスク)
- **Phase 3-C (Unity開発環境)**: ✅ 完了 (4/4タスク)
- **Phase 3-D (Unityサンプル)**: 🔄 進行中 (4/5タスク) — D-1~D-4実装完了、D-5ユーザー動作確認待ち
- **Phase 3-E (ドキュメント更新)**: ⬜ 未着手 (0/3タスク)

---

## 依存関係

```
Phase 3-A (フォルダ構造)
  ├─→ Phase 3-B (WPF)
  │
  └─→ Phase 3-C (Unity環境調査・構築)
        C-1 (WebRTC方式調査) ─┐
        C-2 (Core.dll調査)   ─┼→ C-4 (プロジェクト作成) → Phase 3-D (Unityサンプル)
        C-3 (MCP調査)  ──────┘
                                                              ↓
Phase 3-E (ドキュメント) ←─────────────────── 3-B, 3-D 完了後
```

3-B と 3-C/D は並行作業可能。C-1～C-3 の調査タスクも並行実行可能。

---

## 目標フォルダ構成

```
VmmTrackerDataSender/
├── dotnet/
│   ├── VmmTrackerCore/                # netstandard2.1 (既存・変更なし)
│   ├── VmmTrackerWebRtc/             # net8.0 classlib (NEW)
│   │   ├── WebRTCReceiver.cs         # VmmTrackerReceiver から移動
│   │   └── AesGcmAnswerDecryptor.cs  # VmmTrackerReceiver から移動
│   ├── VmmTrackerReceiver/           # net8.0 exe (Program.cs のみに縮小)
│   ├── VmmTrackerWpf/                # net8.0-windows WPF app (NEW)
│   ├── VmmTrackerDataSender.Tests/
│   └── VmmTrackerDataSender.sln
├── unity/
│   └── VmmTrackerUnitySample/        # Unity 6 project (NEW)
├── web/                              # (変更なし)
└── ...
```

---

## タスク構成

### Phase 3-A: フォルダ構造の見直し

- [x] **A-1 [実装]**: VmmTrackerWebRtc ライブラリプロジェクトの作成
  - net8.0 classlib。NuGet: SIPSorcery 10.0.3。参照: VmmTrackerCore
  - `dotnet/VmmTrackerWebRtc/VmmTrackerWebRtc.csproj` を新規作成

- [x] **A-2 [実装]**: WebRTCReceiver.cs の移動
  - VmmTrackerReceiver → VmmTrackerWebRtc に移動
  - Console.WriteLine を `Action<string>? Log` プロパティに置き換え (ライブラリ汎用化)
  - namespace を `VmmTrackerReceiver` → `VmmTrackerWebRtc` に変更

- [x] **A-3 [実装]**: AesGcmAnswerDecryptor.cs の移動
  - VmmTrackerReceiver → VmmTrackerWebRtc に移動
  - namespace を `VmmTrackerReceiver` → `VmmTrackerWebRtc` に変更

- [x] **A-4 [実装]**: 既存プロジェクトの参照更新
  - VmmTrackerReceiver.csproj: SIPSorcery, OpenCvSharp4.*, ZXing.Net を削除 (未使用)。VmmTrackerWebRtc 参照追加
  - sln に VmmTrackerWebRtc を追加
  - `dotnet build` + `dotnet test` で既存動作を確認

---

### Phase 3-B: WPFサンプルアプリ

- [x] **B-1 [実装]**: WPFプロジェクト作成
  - net8.0-windows, UseWPF。参照: VmmTrackerCore, VmmTrackerWebRtc。NuGet: QRCoder
  - sln に追加。空ウィンドウで起動確認

- [x] **B-2 [実装]**: メインウィンドウUI
  - 接続状態テキスト、QRコード Image、URL TextBox (コピー用)
  - 「接続開始」「Answer取得」ボタン、フォーマット ComboBox
  - トラッキングデータ表示 TextBlock

- [x] **B-3 [実装]**: シグナリングフロー (Offer生成 → QR表示)
  - GenerateKey/Token → InitializeAsOfferer → BuildUrl → QRCoder で Image に表示

- [x] **B-4 [実装]**: Answer取得 → 接続確立
  - GetAnswerAsync → Decrypt → SetRemoteAnswer → WaitForConnection
  - ConnectionStateChanged で状態表示をリアルタイム更新

- [x] **B-5 [実装]**: トラッキングデータのリアルタイム表示
  - DataReceived → Dispatcher.Invoke でUI更新 (100msスロットリング)
  - HeadPose + BlendShape先頭数値 + 受信FPS

- [x] **B-6 [実装]**: エラーハンドリングと終了処理
  - ErrorOccurred ハンドリング、Closing での Dispose、多重押し防止

---

### Phase 3-C: Unity開発環境

- [x] **C-1 [調査]**: Unity側WebRTC実装方式の調査・選定
  - **案A**: com.unity.webrtc パッケージ
    - Unity 6 対応状況、DataChannel API の有無・使い勝手を調査
    - VmmTrackerCore (SdpCodec等) との統合方法を検討
  - **案B**: SIPSorcery ソースの Unity 移植
    - SIPSorcery の .NET Standard 2.1 互換性、Unity 6 での動作可否を調査
    - NuGet DLL を Assets/Plugins/ に配置する方法 or ソース直接取り込みの検討
  - 調査結果をもとに採用方式を決定し、docs/ に記録

- [x] **C-2 [調査]**: Unity 6 での VmmTrackerCore.dll 利用手順の調査
  - Assets/Plugins/ への DLL 配置方法
  - System.Text.Json の Unity 6 互換性確認 (同梱 or 追加配置が必要か)
  - 調査結果を docs/ に記録

- [x] **C-3 [調査+依頼]**: Unity MCP サーバーのセットアップ調査
  - Claude Code から Unity Editor を操作するための MCP サーバー導入手順を調査
  - ユーザーへの手動セットアップ依頼事項をまとめる

- [x] **C-4 [依頼]**: Unity 6 プロジェクトの作成と DLL/パッケージ配置
  - Unity Hub で `unity/VmmTrackerUnitySample/` に 3D プロジェクト作成
  - C-1 の調査結果に基づき WebRTC パッケージ or DLL を配置
  - C-2 の調査結果に基づき VmmTrackerCore.dll を Assets/Plugins/ に配置
  - コンパイルエラーがないことを確認

---

### Phase 3-D: Unityサンプル

コンソールアプリ (Program.cs RunAutoSignaling) とほぼ同等のフローを Unity 上で実装する。
QRコード生成のみ省略し、接続URLはテキスト表示（手動コピー）で代替。

- [x] **D-1 [実装]**: WebRTC接続クラスの実装
  - C-1 で選定した方式に基づく WebRTC DataChannel 受信の実装
  - com.unity.webrtc の場合: RTCPeerConnection / RTCDataChannel を使った Offer 生成・Answer 設定
  - SIPSorcery の場合: WebRTCReceiver の Unity 向けラッパーまたは移植
  - VmmTrackerCore の SdpCodec と連携した SDP 圧縮/復元

- [x] **D-2 [実装]**: シグナリングフローの実装
  - AES鍵/トークン生成 → Offer生成 → URL構築 → UI表示
  - SignalingApiClient で Answer 取得 → 復号 → SetRemoteAnswer
  - AesGcm 復号は Unity で利用可能か要確認 (不可の場合は代替実装)
  - QRコード生成は省略、URLをテキストで表示しユーザーに手動コピーを促す

- [x] **D-3 [実装]**: サンプルUI (MonoBehaviour)
  - Inspector で Compressed/Readable フォーマットを選択
  - 「接続開始」「Answer取得」ボタン (uGUI)
  - 接続URL表示テキスト、接続状態テキスト
  - トラッキングデータ表示 (HeadPose + BlendShape先頭数値 + 受信FPS)

- [x] **D-4 [実装]**: エラーハンドリングと終了処理
  - 接続失敗時のUI表示、OnDestroy での Dispose
  - メインスレッドへのディスパッチ (Unity メインスレッド制約への対応)

- [ ] **D-5 [依頼]**: サンプルシーンの構成と動作確認
  - 空の GameObject に TrackerSampleUI スクリプトをアタッチ (UI は全てコードから生成される)
  - Play モードでモバイルとの E2E 接続テスト

---

### Phase 3-E: ドキュメント更新

- [ ] **E-1 [実装]**: dotnet-api-reference.md の更新 (VmmTrackerWebRtc 反映)
- [ ] **E-2 [実装]**: Unity セットアップガイド (docs/unity-setup-guide.md)
- [ ] **E-3 [実装]**: CLAUDE.md / README.md の更新

---

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `dotnet/VmmTrackerReceiver/WebRTCReceiver.cs` | 移動元。VmmTrackerWebRtc に抽出 |
| `dotnet/VmmTrackerReceiver/AesGcmAnswerDecryptor.cs` | 移動元 |
| `dotnet/VmmTrackerReceiver/Program.cs` | WPF実装の参考元 (RunAutoSignaling フロー) |
| `docs/dotnet-api-reference.md` | 統合フロー手順の記載あり |

---

## 検証方法

- Phase 3-A 完了後: `dotnet build dotnet/VmmTrackerDataSender.sln` + `dotnet test` で既存動作が壊れていないことを確認
- Phase 3-B 完了後: WPF アプリを起動し、モバイルとの E2E 接続テスト (Phase 2-E と同等のフロー)
- Phase 3-D 完了後: Unity Editor の Play モードでモバイルとの E2E 接続テスト。シグナリング→WebRTC接続→トラッキングデータ受信表示を確認
