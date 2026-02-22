# VMM Tracker Unity Sample

Unity 6 で WebRTC DataChannel 経由の顔トラッキングデータを受信するサンプルプロジェクト。
コンソールアプリ (VmmTrackerReceiver) と同等のシグナリング → WebRTC 接続 → データ受信フローを Unity 上で実装している。

## セットアップ

1. Unity Hub で本プロジェクトを開く (Unity 6)
2. NuGetForUnity でパッケージを復元 (初回のみ自動)
3. `Assets/Plugins/` に VmmTrackerCore.dll と依存 DLL を配置 (後述)
4. SampleScene を開き、Play モードで実行

## 参照パッケージ / ライブラリ

### Unity パッケージ (Packages/manifest.json)

- [com.unity.webrtc](https://docs.unity3d.com/Packages/com.unity.webrtc@3.0/manual/index.html) 3.0.0 — WebRTC (DataChannel, ICE, DTLS)

### NuGet パッケージ (NuGetForUnity 経由)

- [Portable.BouncyCastle](https://www.nuget.org/packages/Portable.BouncyCastle) 1.9.0 — AES-128-GCM 復号 (Unity Mono では System.Security.Cryptography.AesGcm が使用不可のため)

### Assets/Plugins/ 配置 DLL

以下の DLL は `dotnet publish` で生成し手動配置する (git 管理外)。

| DLL | 元パッケージ | 用途 |
|---|---|---|
| VmmTrackerCore.dll | 本リポジトリ dotnet/VmmTrackerCore | データモデル、デシリアライザ、SDP コーデック、シグナリング |
| System.Text.Json.dll | System.Text.Json 8.0.6 | JSON デシリアライズ |
| System.Text.Encodings.Web.dll | System.Text.Json 依存 | |
| Microsoft.Bcl.AsyncInterfaces.dll | System.Text.Json 依存 | |
| System.Runtime.CompilerServices.Unsafe.dll | System.Text.Json 依存 | |

#### DLL の再生成手順

```bash
dotnet publish dotnet/VmmTrackerCore/VmmTrackerCore.csproj -c Release
# 出力先: dotnet/VmmTrackerCore/bin/Release/netstandard2.1/publish/
# 上記フォルダから必要な DLL を Assets/Plugins/ にコピー
```
