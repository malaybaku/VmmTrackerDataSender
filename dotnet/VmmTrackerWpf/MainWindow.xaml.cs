using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using QRCoder;
using VmmTrackerCore;
using VmmTrackerWebRtc;

namespace VmmTrackerWpf;

public partial class MainWindow : Window
{
    private WebRTCReceiver? _receiver;
    private CancellationTokenSource? _cts;
    private byte[]? _aesKey;
    private string? _token;

    // FPS tracking
    private int _frameCount;
    private readonly Stopwatch _fpsStopwatch = new();

    // UI throttle
    private DateTime _lastUiUpdate = DateTime.MinValue;
    private static readonly TimeSpan UiUpdateInterval = TimeSpan.FromMilliseconds(100);

    public MainWindow()
    {
        InitializeComponent();
    }

    private async void StartButton_Click(object sender, RoutedEventArgs e)
    {
        StartButton.IsEnabled = false;
        FetchAnswerButton.Visibility = Visibility.Collapsed;
        UrlPanel.Visibility = Visibility.Collapsed;
        QrImage.Source = null;
        TrackingDataText.Text = "";
        LogText.Text = "";

        try
        {
            // Select deserializer
            var formatItem = (ComboBoxItem)FormatComboBox.SelectedItem;
            var format = formatItem.Content.ToString()!;
            ITrackingDataDeserializer deserializer = format switch
            {
                "compressed" => new CompressedDeserializer(),
                "readable" => new ReadableDeserializer(),
                _ => throw new InvalidOperationException($"Unknown format: {format}")
            };

            // Clean up previous receiver
            CleanupReceiver();

            _cts = new CancellationTokenSource();
            _receiver = new WebRTCReceiver(deserializer);
            _receiver.Log = msg => Dispatcher.Invoke(() => AppendLog(msg));

            SetupReceiverHandlers();

            SetStatus("Offer生成中...");

            // Generate AES key and session token
            _aesKey = SignalingCrypto.GenerateKey();
            _token = SignalingCrypto.GenerateToken();
            AppendLog($"Session token: {_token}");

            // Capture compressed offer
            var offerTcs = new TaskCompletionSource<byte[]>();
            _receiver.CompressedSdpReady += (data, isOffer) =>
            {
                if (isOffer) offerTcs.TrySetResult(data);
            };

            await _receiver.InitializeAsOfferer();
            var offerBytes = await offerTcs.Task;

            // Build URL and show QR
            var url = SignalingUrl.BuildUrl(_token, _aesKey, offerBytes);
            ShowQrCode(url);

            UrlTextBox.Text = url;
            UrlPanel.Visibility = Visibility.Visible;
            FetchAnswerButton.Visibility = Visibility.Visible;
            FetchAnswerButton.IsEnabled = true;

            SetStatus("QRコードをモバイルでスキャンしてください");
        }
        catch (Exception ex)
        {
            SetStatus($"エラー: {ex.Message}");
            StartButton.IsEnabled = true;
        }
    }

    private async void FetchAnswerButton_Click(object sender, RoutedEventArgs e)
    {
        if (_receiver == null || _aesKey == null || _token == null || _cts == null)
            return;

        FetchAnswerButton.IsEnabled = false;

        try
        {
            SetStatus("Answer取得中...");

            using var apiClient = new SignalingApiClient();
            var encryptedBase64 = await apiClient.GetAnswerAsync(_token, _cts.Token);
            if (encryptedBase64 == null)
            {
                SetStatus("Answerが見つかりません。モバイルがまだ接続していない可能性があります。");
                FetchAnswerButton.IsEnabled = true;
                return;
            }

            AppendLog("Answer received! Decrypting...");

            IAnswerDecryptor decryptor = new AesGcmAnswerDecryptor();
            var encryptedData = Convert.FromBase64String(encryptedBase64);
            var answerBytes = decryptor.Decrypt(_aesKey, encryptedData);

            _receiver.SetRemoteAnswer(answerBytes);
            SetStatus("接続確立中...");

            // Reset FPS counter
            _frameCount = 0;
            _fpsStopwatch.Restart();

            // Wait for connection in background
            _ = Task.Run(async () =>
            {
                try
                {
                    await _receiver.WaitForConnection(_cts.Token);
                }
                catch (OperationCanceledException) { }
                catch (Exception ex)
                {
                    Dispatcher.Invoke(() => SetStatus($"接続失敗: {ex.Message}"));
                }
            });
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            SetStatus($"エラー: {ex.Message}");
            FetchAnswerButton.IsEnabled = true;
        }
    }

    private void SetupReceiverHandlers()
    {
        if (_receiver == null) return;

        _receiver.ConnectionStateChanged += state =>
        {
            Dispatcher.Invoke(() =>
            {
                var text = state switch
                {
                    SIPSorcery.Net.RTCPeerConnectionState.connecting => "接続中...",
                    SIPSorcery.Net.RTCPeerConnectionState.connected => "接続済み - データ受信中",
                    SIPSorcery.Net.RTCPeerConnectionState.disconnected => "切断されました",
                    SIPSorcery.Net.RTCPeerConnectionState.failed => "接続失敗",
                    SIPSorcery.Net.RTCPeerConnectionState.closed => "接続終了",
                    _ => state.ToString()
                };
                SetStatus(text);

                if (state == SIPSorcery.Net.RTCPeerConnectionState.connected)
                {
                    QrImage.Source = null;
                    UrlPanel.Visibility = Visibility.Collapsed;
                    FetchAnswerButton.Visibility = Visibility.Collapsed;
                }
                else if (state == SIPSorcery.Net.RTCPeerConnectionState.failed ||
                         state == SIPSorcery.Net.RTCPeerConnectionState.closed ||
                         state == SIPSorcery.Net.RTCPeerConnectionState.disconnected)
                {
                    StartButton.IsEnabled = true;
                }
            });
        };

        _receiver.DataReceived += data =>
        {
            _frameCount++;

            var now = DateTime.UtcNow;
            if (now - _lastUiUpdate < UiUpdateInterval) return;
            _lastUiUpdate = now;

            var elapsed = _fpsStopwatch.Elapsed.TotalSeconds;
            var fps = elapsed > 0 ? _frameCount / elapsed : 0;

            var hp = data.HeadPose;
            var text = $"=== Tracking Data (FPS: {fps:F1}) ===" + Environment.NewLine +
                       $"HeadPose:" + Environment.NewLine +
                       $"  pos: ({hp.PositionX:F3}, {hp.PositionY:F3}, {hp.PositionZ:F3})" + Environment.NewLine +
                       $"  rot: ({hp.RotationX:F3}, {hp.RotationY:F3}, {hp.RotationZ:F3}, {hp.RotationW:F3})" + Environment.NewLine +
                       Environment.NewLine +
                       $"BlendShapes (first 10 of {data.BlendShapes.Length}):" + Environment.NewLine;

            var count = Math.Min(10, data.BlendShapes.Length);
            for (var i = 0; i < count; i++)
            {
                text += $"  [{i}]: {data.BlendShapes[i]}" + Environment.NewLine;
            }
            if (data.BlendShapes.Length > 10)
            {
                text += $"  ... ({data.BlendShapes.Length - 10} more)";
            }

            Dispatcher.Invoke(() => TrackingDataText.Text = text);
        };

        _receiver.ErrorOccurred += error =>
        {
            Dispatcher.Invoke(() => AppendLog($"[ERROR] {error}"));
        };
    }

    private void ShowQrCode(string url)
    {
        using var qrGenerator = new QRCodeGenerator();
        var qrData = qrGenerator.CreateQrCode(url, QRCodeGenerator.ECCLevel.L);
        var pngQr = new PngByteQRCode(qrData);
        var pngBytes = pngQr.GetGraphic(10);

        var bitmap = new BitmapImage();
        bitmap.BeginInit();
        bitmap.StreamSource = new MemoryStream(pngBytes);
        bitmap.CacheOption = BitmapCacheOption.OnLoad;
        bitmap.EndInit();
        bitmap.Freeze();

        QrImage.Source = bitmap;
    }

    private void CopyUrlButton_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrEmpty(UrlTextBox.Text))
        {
            Clipboard.SetText(UrlTextBox.Text);
        }
    }

    private void SetStatus(string text)
    {
        StatusText.Text = text;
    }

    private void AppendLog(string message)
    {
        LogText.Text += message + Environment.NewLine;
    }

    private void CleanupReceiver()
    {
        _cts?.Cancel();
        _cts?.Dispose();
        _cts = null;

        _receiver?.Dispose();
        _receiver = null;

        _aesKey = null;
        _token = null;
        _fpsStopwatch.Stop();
    }

    private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
    {
        CleanupReceiver();
    }
}
