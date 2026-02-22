# Unity 6 統合調査メモ (Phase 3-C)

## C-1: WebRTC実装方式の選定

### 結論: **com.unity.webrtc を採用**

### 比較

| 観点 | com.unity.webrtc | SIPSorcery |
|---|---|---|
| Unity 6 公式サポート | あり (6000.3) | なし |
| DataChannel | 完全サポート | あり (Unity未検証) |
| インストール | Package Manager 1行 | 5+ DLL手動管理 |
| SdpCodec互換性 | あり (`RTCSessionDescription.sdp` で生SDP文字列にアクセス可) | 完全互換 (同一API) |
| 非同期モデル | コルーチン (`yield return`) | async/await |
| IL2CPP互換性 | 検証済み | 未検証 (DnsClient問題の前例) |

### 移植上の注意点
- `async/await` → コルーチン (`yield return`) への変換が必要
- API対応: `pc.createOffer()` → `pc.CreateOffer()` (非同期Op)、`pc.setRemoteDescription()` → `pc.SetRemoteDescription(ref desc)`
- SIPSorceryの `RTCSessionDescriptionInit` → com.unity.webrtcの `RTCSessionDescription` 構造体
- VmmTrackerCoreの `SdpCodec.Encode/Decode` はそのまま利用可能

### パッケージ情報
- バージョン: 3.0.0-pre.8 (プレリリース)
- インストール: Package Manager → Git URL `com.unity.webrtc@3.0.0-pre.8`
- 対応プラットフォーム: Windows x64, Linux, macOS (Apple Silicon), iOS, Android ARM64。**WebGL非対応**

---

## C-2: VmmTrackerCore.dll の Unity 6 互換性

### .NET Standard 2.1 サポート
- Unity 6 はデフォルトで .NET Standard 2.1 API互換
- VmmTrackerCore.dll (netstandard2.1) はそのまま読み込み可能

### System.Text.Json
- **Unity 6 には同梱されていない** → DLLを `Assets/Plugins/` に手動配置が必要
- 必要DLL:
  - `System.Text.Json.dll`
  - `System.Text.Encodings.Web.dll`
  - `Microsoft.Bcl.AsyncInterfaces.dll`
  - `System.Runtime.CompilerServices.Unsafe.dll`
  - (Unity 6ランタイムに含まれるものは不要の可能性あり、要動作確認)
- IL2CPPビルド時は `link.xml` で保護が必要:
  ```xml
  <linker>
    <assembly fullname="System.Text.Json" preserve="all"/>
    <assembly fullname="System.Text.Encodings.Web" preserve="all"/>
  </linker>
  ```

### AES-GCM (AesGcm クラス)
- **Unity 6 (Mono) では使用不可** (`PlatformNotSupportedException`)
- VmmTrackerCore の `IAnswerDecryptor` インタフェースによりDI済み
- **Unity向けには BouncyCastle ベースの実装を提供する**
  - パッケージ: `Portable.BouncyCastle` 1.9.0 (netstandard2.0、マネージドC#、依存なし)
  - `GcmBlockCipher` + `AesEngine` で AES-128-GCM を実装

### DLL配置
```
Assets/
└── Plugins/
    ├── VmmTrackerCore.dll
    ├── System.Text.Json.dll
    ├── System.Text.Encodings.Web.dll
    ├── Microsoft.Bcl.AsyncInterfaces.dll
    ├── System.Runtime.CompilerServices.Unsafe.dll
    └── BouncyCastle.Crypto.dll   (AES-GCM代替用)
```

---

## C-3: Unity MCP サーバー

### 推奨: CoplayDev/unity-mcp
- GitHub Stars: ~6,100 (最多)
- Unity 2021.3+ 対応
- Python (uvx) ベース
- Claude Code向けドキュメント整備済み

### セットアップ手順 (ユーザー向け)
1. **前提**: Python 3.11+, `uv` パッケージマネージャー
2. Unity側: Package Manager → Git URL: `https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#beta`
3. Unity: Window > MCP for Unity → Start Server
4. Claude Code: `claude mcp add --scope user --transport stdio coplay-mcp --env MCP_TOOL_TIMEOUT=720000 -- uvx --python ">=3.11" coplay-mcp-server@latest`

### MCP無しの代替ワークフロー
- Claude Codeが `.cs` ファイルを直接読み書き
- ユーザーがUnity Editor操作 (GameObject配置、Play Mode) を手動で実行
- シーンファイル (.unity) はYAMLだが直接編集は非推奨
