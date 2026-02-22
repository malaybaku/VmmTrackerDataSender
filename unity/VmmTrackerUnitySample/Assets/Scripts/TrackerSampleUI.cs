using System;
using System.Collections;
using System.Diagnostics;
using System.Text.Json;
using Unity.WebRTC;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Networking;
using UnityEngine.UI;
using VmmTrackerCore;

/// <summary>
/// Sample UI MonoBehaviour demonstrating the full signaling and data reception flow.
/// All UI elements are generated from code (no scene setup required except attaching this script).
/// QR code generation is omitted; the connection URL is displayed as text for manual copy.
/// </summary>
public class TrackerSampleUI : MonoBehaviour
{
    [SerializeField] private bool useCompressedFormat = true;

    // UI references (created at runtime)
    private Text _statusText;
    private Text _urlText;
    private Text _trackingDataText;
    private Text _logText;
    private Button _startButton;
    private Button _fetchAnswerButton;

    private UnityWebRTCReceiver _receiver;
    private byte[] _aesKey;
    private string _token;
    private bool _isConnecting;

    // FPS tracking
    private int _frameCount;
    private readonly Stopwatch _fpsStopwatch = new Stopwatch();

    // UI throttle
    private float _lastUiUpdateTime;
    private const float UiUpdateInterval = 0.1f;

    private Font _font;

    private void Start()
    {
        _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        BuildUI();

        _fetchAnswerButton.gameObject.SetActive(false);
        _startButton.onClick.AddListener(OnStartClicked);
        _fetchAnswerButton.onClick.AddListener(OnFetchAnswerClicked);

        SetStatus("Ready");
    }

    // ── UI Construction ──

    private void BuildUI()
    {
        // Ensure EventSystem exists
        if (FindAnyObjectByType<EventSystem>() == null)
        {
            var esObj = new GameObject("EventSystem");
            esObj.AddComponent<EventSystem>();
            esObj.AddComponent<StandaloneInputModule>();
        }

        // Canvas
        var canvasObj = new GameObject("TrackerSampleCanvas");
        var canvas = canvasObj.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var scaler = canvasObj.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1280, 720);
        canvasObj.AddComponent<GraphicRaycaster>();

        // Root panel (full screen with padding)
        var root = CreateRectObject("Root", canvasObj.transform);
        StretchFill(root, new RectOffset(20, 20, 20, 20));
        var rootLayout = root.AddComponent<VerticalLayoutGroup>();
        rootLayout.spacing = 8;
        rootLayout.childForceExpandWidth = true;
        rootLayout.childForceExpandHeight = false;
        rootLayout.padding = new RectOffset(10, 10, 10, 10);

        // Status
        _statusText = CreateLabel(root.transform, "Status", 22, Color.white);

        // Button row
        var buttonRow = CreateRectObject("ButtonRow", root.transform);
        var rowLayout = buttonRow.AddComponent<HorizontalLayoutGroup>();
        rowLayout.spacing = 12;
        rowLayout.childForceExpandWidth = false;
        rowLayout.childForceExpandHeight = false;
        var rowElement = buttonRow.AddComponent<LayoutElement>();
        rowElement.minHeight = 44;

        _startButton = CreateButton(buttonRow.transform, "Start Connection");
        _fetchAnswerButton = CreateButton(buttonRow.transform, "Fetch Answer");

        // URL
        _urlText = CreateLabel(root.transform, "", 13, new Color(0.5f, 0.9f, 1f));

        // Tracking data
        _trackingDataText = CreateLabel(root.transform, "", 15, new Color(0.6f, 1f, 0.6f));

        // Log
        _logText = CreateLabel(root.transform, "", 13, new Color(0.7f, 0.7f, 0.7f));
    }

    private GameObject CreateRectObject(string name, Transform parent)
    {
        var obj = new GameObject(name, typeof(RectTransform));
        obj.transform.SetParent(parent, false);
        return obj;
    }

    private void StretchFill(GameObject obj, RectOffset margin)
    {
        var rt = obj.GetComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = new Vector2(margin.left, margin.bottom);
        rt.offsetMax = new Vector2(-margin.right, -margin.top);
    }

    private Text CreateLabel(Transform parent, string text, int fontSize, Color color)
    {
        var obj = CreateRectObject("Text", parent);
        var t = obj.AddComponent<Text>();
        t.text = text;
        t.fontSize = fontSize;
        t.color = color;
        t.font = _font;
        t.horizontalOverflow = HorizontalWrapMode.Wrap;
        t.verticalOverflow = VerticalWrapMode.Overflow;
        var le = obj.AddComponent<LayoutElement>();
        le.minHeight = fontSize + 6;
        return t;
    }

    private Button CreateButton(Transform parent, string label)
    {
        var obj = CreateRectObject("Button", parent);
        var img = obj.AddComponent<Image>();
        img.color = new Color(0.25f, 0.25f, 0.3f);
        var btn = obj.AddComponent<Button>();
        var le = obj.AddComponent<LayoutElement>();
        le.minWidth = 200;
        le.minHeight = 40;

        // Button text
        var textObj = CreateRectObject("Text", obj.transform);
        StretchFill(textObj, new RectOffset(0, 0, 0, 0));
        var t = textObj.AddComponent<Text>();
        t.text = label;
        t.fontSize = 18;
        t.color = Color.white;
        t.alignment = TextAnchor.MiddleCenter;
        t.font = _font;

        return btn;
    }

    // ── Connection Flow ──

    private void OnStartClicked()
    {
        if (_isConnecting) return;
        StartCoroutine(StartConnection());
    }

    private IEnumerator StartConnection()
    {
        _isConnecting = true;
        _startButton.interactable = false;
        _fetchAnswerButton.gameObject.SetActive(false);
        _trackingDataText.text = "";
        _logText.text = "";
        _urlText.text = "";

        CleanupReceiver();

        ITrackingDataDeserializer deserializer = useCompressedFormat
            ? (ITrackingDataDeserializer)new CompressedDeserializer()
            : new ReadableDeserializer();

        _receiver = new UnityWebRTCReceiver(deserializer);
        _receiver.Log = msg => AppendLog(msg);
        SetupReceiverHandlers();

        SetStatus("Offer generating...");

        _aesKey = SignalingCrypto.GenerateKey();
        _token = SignalingCrypto.GenerateToken();
        AppendLog($"Session token: {_token}");

        byte[] offerBytes = null;
        _receiver.CompressedSdpReady += (data, isOffer) =>
        {
            if (isOffer)
            {
                offerBytes = data;
                UnityEngine.Debug.Log($"[TrackerSample] Compressed offer SDP ({data.Length} bytes): {Convert.ToBase64String(data)}");
            }
        };

        yield return StartCoroutine(_receiver.InitializeAsOfferer());

        if (offerBytes == null)
        {
            SetStatus("Offer generation failed");
            _startButton.interactable = true;
            _isConnecting = false;
            yield break;
        }

        var url = SignalingUrl.BuildUrl(_token, _aesKey, offerBytes);
        _urlText.text = url;
        UnityEngine.Debug.Log($"[TrackerSample] Connection URL: {url}");

        _fetchAnswerButton.gameObject.SetActive(true);
        _fetchAnswerButton.interactable = true;

        SetStatus("Open the URL on mobile (copy from below)");
    }

    private void OnFetchAnswerClicked()
    {
        StartCoroutine(FetchAnswer());
    }

    private IEnumerator FetchAnswer()
    {
        if (_receiver == null || _aesKey == null || _token == null)
            yield break;

        _fetchAnswerButton.interactable = false;
        SetStatus("Fetching answer...");

        var apiUrl = $"{SignalingConfig.ApiBaseUrl}/{Uri.EscapeDataString(_token)}";
        string encryptedBase64 = null;

        using (var request = UnityWebRequest.Get(apiUrl))
        {
            yield return request.SendWebRequest();

            if (request.result != UnityWebRequest.Result.Success)
            {
                SetStatus($"Fetch error: {request.error}");
                _fetchAnswerButton.interactable = true;
                yield break;
            }

            try
            {
                using var doc = JsonDocument.Parse(request.downloadHandler.text);
                if (doc.RootElement.TryGetProperty("answer", out var answerElement))
                {
                    encryptedBase64 = answerElement.GetString();
                }
            }
            catch (Exception ex)
            {
                SetStatus($"JSON parse error: {ex.Message}");
                _fetchAnswerButton.interactable = true;
                yield break;
            }
        }

        if (string.IsNullOrEmpty(encryptedBase64))
        {
            SetStatus("Answer not found. Mobile may not have connected yet.");
            _fetchAnswerButton.interactable = true;
            yield break;
        }

        AppendLog("Answer received! Decrypting...");

        byte[] answerBytes;
        try
        {
            IAnswerDecryptor decryptor = new BouncyCastleAnswerDecryptor();
            var encryptedData = Convert.FromBase64String(encryptedBase64);
            answerBytes = decryptor.Decrypt(_aesKey, encryptedData);
        }
        catch (Exception ex)
        {
            SetStatus($"Decryption error: {ex.Message}");
            _fetchAnswerButton.interactable = true;
            yield break;
        }

        yield return StartCoroutine(_receiver.SetRemoteAnswer(answerBytes));

        SetStatus("Establishing connection...");

        _frameCount = 0;
        _fpsStopwatch.Restart();
    }

    // ── Event Handlers ──

    private void SetupReceiverHandlers()
    {
        _receiver.ConnectionStateChanged += state =>
        {
            string text;
            switch (state)
            {
                case RTCPeerConnectionState.Connecting:
                    text = "Connecting...";
                    break;
                case RTCPeerConnectionState.Connected:
                    text = "Connected - Receiving data";
                    break;
                case RTCPeerConnectionState.Disconnected:
                    text = "Disconnected";
                    break;
                case RTCPeerConnectionState.Failed:
                    text = "Connection failed";
                    break;
                case RTCPeerConnectionState.Closed:
                    text = "Connection closed";
                    break;
                default:
                    text = state.ToString();
                    break;
            }
            SetStatus(text);

            if (state == RTCPeerConnectionState.Connected)
            {
                _urlText.text = "";
                _fetchAnswerButton.gameObject.SetActive(false);
            }
            else if (state == RTCPeerConnectionState.Failed ||
                     state == RTCPeerConnectionState.Closed ||
                     state == RTCPeerConnectionState.Disconnected)
            {
                _startButton.interactable = true;
                _isConnecting = false;
            }
        };

        _receiver.DataReceived += data =>
        {
            _frameCount++;

            if (Time.realtimeSinceStartup - _lastUiUpdateTime < UiUpdateInterval) return;
            _lastUiUpdateTime = Time.realtimeSinceStartup;

            var elapsed = _fpsStopwatch.Elapsed.TotalSeconds;
            var fps = elapsed > 0 ? _frameCount / elapsed : 0;

            var hp = data.HeadPose;
            var text = $"=== Tracking Data (FPS: {fps:F1}) ===\n" +
                       $"HeadPose:\n" +
                       $"  pos: ({hp.PositionX:F3}, {hp.PositionY:F3}, {hp.PositionZ:F3})\n" +
                       $"  rot: ({hp.RotationX:F3}, {hp.RotationY:F3}, {hp.RotationZ:F3}, {hp.RotationW:F3})\n\n" +
                       $"BlendShapes (first 10 of {data.BlendShapes.Length}):\n";

            var count = Math.Min(10, data.BlendShapes.Length);
            for (var i = 0; i < count; i++)
            {
                text += $"  [{i}]: {data.BlendShapes[i]}\n";
            }
            if (data.BlendShapes.Length > 10)
            {
                text += $"  ... ({data.BlendShapes.Length - 10} more)";
            }

            _trackingDataText.text = text;
        };

        _receiver.ErrorOccurred += error =>
        {
            AppendLog($"[ERROR] {error}");
        };
    }

    // ── Helpers ──

    private void SetStatus(string text)
    {
        _statusText.text = text;
    }

    private void AppendLog(string message)
    {
        _logText.text += message + "\n";
    }

    private void CleanupReceiver()
    {
        _receiver?.Dispose();
        _receiver = null;
        _aesKey = null;
        _token = null;
        _fpsStopwatch.Stop();
        _isConnecting = false;
    }

    private void OnDestroy()
    {
        CleanupReceiver();
    }
}
