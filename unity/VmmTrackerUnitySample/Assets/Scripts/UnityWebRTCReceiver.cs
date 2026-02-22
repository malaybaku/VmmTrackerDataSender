using System;
using System.Collections;
using System.Collections.Generic;
using Unity.WebRTC;
using UnityEngine;
using VmmTrackerCore;

/// <summary>
/// WebRTC DataChannel receiver using com.unity.webrtc.
/// Provides coroutine-based async operations for WebRTC signaling and data reception.
/// </summary>
public class UnityWebRTCReceiver : IDisposable
{
    private readonly ITrackingDataDeserializer _deserializer;
    private RTCPeerConnection _peerConnection;
    private RTCDataChannel _dataChannel;
    private bool _disposed;

    // ICE gathering
    private readonly List<string> _collectedIceCandidates = new List<string>();
    private bool _iceGatheringComplete;

    /// <summary>
    /// Optional log action for diagnostic messages.
    /// </summary>
    public Action<string> Log { get; set; }

    /// <summary>
    /// Event fired when tracking data is received.
    /// </summary>
    public event Action<TrackingData> DataReceived;

    /// <summary>
    /// Event fired when an error occurs.
    /// </summary>
    public event Action<string> ErrorOccurred;

    /// <summary>
    /// Event fired when compressed SDP (binary) is ready.
    /// Parameters: (compressedSdp, isOffer)
    /// </summary>
    public event Action<byte[], bool> CompressedSdpReady;

    /// <summary>
    /// Event fired when connection state changes.
    /// </summary>
    public event Action<RTCPeerConnectionState> ConnectionStateChanged;

    /// <summary>
    /// Current connection state.
    /// </summary>
    public RTCPeerConnectionState ConnectionState =>
        _peerConnection != null ? _peerConnection.ConnectionState : RTCPeerConnectionState.Closed;

    public UnityWebRTCReceiver(ITrackingDataDeserializer deserializer)
    {
        _deserializer = deserializer ?? throw new ArgumentNullException(nameof(deserializer));
    }

    /// <summary>
    /// Initialize as offerer (PC side generates offer).
    /// Must be run via MonoBehaviour.StartCoroutine().
    /// </summary>
    public IEnumerator InitializeAsOfferer()
    {
        Log?.Invoke("[WebRTC] Initializing as offerer...");

        var config = new RTCConfiguration
        {
            iceServers = new[]
            {
                new RTCIceServer { urls = new[] { "stun:stun.l.google.com:19302" } }
            }
        };

        _peerConnection = new RTCPeerConnection(ref config);
        SetupPeerConnectionHandlers();

        var dcInit = new RTCDataChannelInit { ordered = true };
        _dataChannel = _peerConnection.CreateDataChannel("tracking-data", dcInit);
        SetupDataChannelHandlers(_dataChannel);

        // Create offer
        var offerOp = _peerConnection.CreateOffer();
        yield return offerOp;

        if (offerOp.IsError)
        {
            var error = $"Failed to create offer: {offerOp.Error.message}";
            Log?.Invoke($"[WebRTC ERROR] {error}");
            ErrorOccurred?.Invoke(error);
            yield break;
        }

        var offerDesc = offerOp.Desc;

        // Set local description
        var setLocalOp = _peerConnection.SetLocalDescription(ref offerDesc);
        yield return setLocalOp;

        if (setLocalOp.IsError)
        {
            var error = $"Failed to set local description: {setLocalOp.Error.message}";
            Log?.Invoke($"[WebRTC ERROR] {error}");
            ErrorOccurred?.Invoke(error);
            yield break;
        }

        Log?.Invoke("[WebRTC] Offer created, waiting for ICE gathering...");

        // Wait for ICE gathering to complete (with timeout)
        yield return WaitForIceGathering(10f);

        // Encode compressed SDP with collected ICE candidates
        var compressed = SdpCodec.Encode(offerDesc.sdp, true, _collectedIceCandidates.ToArray());
        Log?.Invoke($"[WebRTC] Compressed offer ready, byte length: {compressed.Length}");

        CompressedSdpReady?.Invoke(compressed, true);
    }

    /// <summary>
    /// Set remote answer (when PC is offerer, from compressed binary).
    /// Must be run via MonoBehaviour.StartCoroutine().
    /// </summary>
    public IEnumerator SetRemoteAnswer(byte[] answerBytes)
    {
        if (_peerConnection == null)
        {
            ErrorOccurred?.Invoke("Peer connection not initialized");
            yield break;
        }

        var (answerSdp, _) = SdpCodec.Decode(answerBytes);
        Log?.Invoke("[WebRTC] Decoded answer SDP");

        var desc = new RTCSessionDescription { type = RTCSdpType.Answer, sdp = answerSdp };
        var op = _peerConnection.SetRemoteDescription(ref desc);
        yield return op;

        if (op.IsError)
        {
            var error = $"Failed to set remote description: {op.Error.message}";
            Log?.Invoke($"[WebRTC ERROR] {error}");
            ErrorOccurred?.Invoke(error);
            yield break;
        }

        Log?.Invoke("[WebRTC] Remote answer set");
    }

    private void SetupPeerConnectionHandlers()
    {
        _collectedIceCandidates.Clear();
        _iceGatheringComplete = false;

        _peerConnection.OnIceCandidate = candidate =>
        {
            if (candidate != null)
            {
                Log?.Invoke($"[WebRTC] ICE candidate collected: {candidate.Candidate}");
                _collectedIceCandidates.Add(candidate.Candidate);
            }
        };

        _peerConnection.OnIceGatheringStateChange = state =>
        {
            Log?.Invoke($"[WebRTC] ICE gathering state: {state}");
            if (state == RTCIceGatheringState.Complete)
            {
                _iceGatheringComplete = true;
            }
        };

        _peerConnection.OnConnectionStateChange = state =>
        {
            Log?.Invoke($"[WebRTC] Connection state: {state}");
            ConnectionStateChanged?.Invoke(state);
        };

        _peerConnection.OnDataChannel = channel =>
        {
            Log?.Invoke("[WebRTC] Data channel received");
            _dataChannel = channel;
            SetupDataChannelHandlers(channel);
        };
    }

    private void SetupDataChannelHandlers(RTCDataChannel channel)
    {
        if (channel == null) return;

        channel.OnOpen = () =>
        {
            Log?.Invoke("[WebRTC] Data channel opened");
        };

        channel.OnClose = () =>
        {
            Log?.Invoke("[WebRTC] Data channel closed");
        };

        channel.OnMessage = bytes =>
        {
            try
            {
                if (bytes == null || bytes.Length == 0)
                {
                    Log?.Invoke("[WebRTC] Received empty message");
                    return;
                }

                var trackingData = _deserializer.Deserialize(bytes);
                DataReceived?.Invoke(trackingData);
            }
            catch (Exception ex)
            {
                var error = $"Failed to deserialize data: {ex.Message}";
                Log?.Invoke($"[WebRTC ERROR] {error}");
                ErrorOccurred?.Invoke(error);
            }
        };
    }

    private IEnumerator WaitForIceGathering(float timeoutSeconds)
    {
        var elapsed = 0f;
        while (!_iceGatheringComplete && elapsed < timeoutSeconds)
        {
            yield return null;
            elapsed += Time.deltaTime;
        }

        if (!_iceGatheringComplete)
        {
            Log?.Invoke("[WebRTC] ICE gathering timed out, proceeding with collected candidates");
        }
    }

    public void Close()
    {
        Log?.Invoke("[WebRTC] Closing connection...");

        _dataChannel?.Close();
        _peerConnection?.Close();
        _peerConnection?.Dispose();

        _dataChannel = null;
        _peerConnection = null;
        _collectedIceCandidates.Clear();
        _iceGatheringComplete = false;
    }

    public void Dispose()
    {
        if (_disposed) return;
        Close();
        _disposed = true;
    }
}
