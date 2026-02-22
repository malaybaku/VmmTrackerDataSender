# VMM Tracker Data Receiver - .NET

WebRTC DataChannel 経由で顔トラッキングデータを受信する .NET アプリケーション群。

## プロジェクト構成

```
dotnet/
├── VmmTrackerCore/           # 共通ライブラリ (.NET Standard 2.1)
├── VmmTrackerWebRtc/         # WebRTC受信ライブラリ (.NET 8.0)
├── VmmTrackerReceiver/       # コンソールアプリ (.NET 8.0)
├── VmmTrackerWpf/            # WPFサンプルアプリ (.NET 8.0-windows)
├── VmmTrackerDataSender.Tests/  # ユニットテスト (.NET 8.0)
└── VmmTrackerDataSender.sln
```

## 各プロジェクトの概要と参照パッケージ

### VmmTrackerCore

トラッキングデータモデル、デシリアライザ、SDP圧縮コーデック、シグナリング関連ユーティリティ。
Unity / WPF 等から参照可能な共通ライブラリ。

- **ターゲット**: .NET Standard 2.1
- **NuGet パッケージ**:
  - [System.Text.Json](https://www.nuget.org/packages/System.Text.Json) 8.0.6 — JSON シリアライズ/デシリアライズ

### VmmTrackerWebRtc

SIPSorcery ベースの WebRTC DataChannel 受信と AES-GCM 復号の実装。
VmmTrackerCore から分離されたライブラリで、コンソールアプリと WPF の両方から参照される。

- **ターゲット**: .NET 8.0 (クラスライブラリ)
- **NuGet パッケージ**:
  - [SIPSorcery](https://www.nuget.org/packages/SIPSorcery) 10.0.3 — WebRTC (DataChannel, ICE, DTLS) の .NET 実装
- **プロジェクト参照**: VmmTrackerCore

### VmmTrackerReceiver

コンソールベースのリファレンス受信アプリ。WebRTC シグナリング → 接続 → トラッキングデータ受信の一連フローを実装。

- **ターゲット**: .NET 8.0 (コンソールアプリ)
- **NuGet パッケージ**:
  - [QRCoder](https://www.nuget.org/packages/QRCoder) 1.6.0 — QR コード画像の生成
- **プロジェクト参照**: VmmTrackerCore, VmmTrackerWebRtc

### VmmTrackerWpf

WPF サンプルアプリ。QR コード表示 UI + シグナリング → WebRTC 接続 → トラッキングデータのリアルタイム表示。

- **ターゲット**: .NET 8.0-windows (WPF)
- **NuGet パッケージ**:
  - [QRCoder](https://www.nuget.org/packages/QRCoder) 1.6.0 — QR コード画像の生成
- **プロジェクト参照**: VmmTrackerCore, VmmTrackerWebRtc

### VmmTrackerDataSender.Tests

SdpCodec 等のユニットテスト。

- **ターゲット**: .NET 8.0
- **NuGet パッケージ**:
  - [xunit](https://www.nuget.org/packages/xunit) 2.5.3 — テストフレームワーク
  - [xunit.runner.visualstudio](https://www.nuget.org/packages/xunit.runner.visualstudio) 2.5.3
  - [Microsoft.NET.Test.Sdk](https://www.nuget.org/packages/Microsoft.NET.Test.Sdk) 17.8.0
  - [coverlet.collector](https://www.nuget.org/packages/coverlet.collector) 6.0.0
- **プロジェクト参照**: VmmTrackerCore

## ビルド

```bash
dotnet build dotnet/VmmTrackerDataSender.sln
```

## 実行

### コンソールアプリ (自動シグナリング)

```bash
dotnet run --project dotnet/VmmTrackerReceiver
```

### WPF サンプル

```bash
dotnet run --project dotnet/VmmTrackerWpf
```

### テスト

```bash
dotnet test dotnet/VmmTrackerDataSender.sln
```
