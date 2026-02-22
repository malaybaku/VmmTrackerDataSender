using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using SIPSorcery.Net;
using VmmTrackerCore;

namespace VmmTrackerWebRtc;

/// <summary>
/// WebRTC DataChannel receiver for tracking data
/// </summary>
public class WebRTCReceiver : IDisposable
{
    private readonly ITrackingDataDeserializer _deserializer;
    private RTCPeerConnection? _peerConnection;
    private RTCDataChannel? _dataChannel;
    private bool _disposed = false;

    // ICE gathering
    private readonly List<string> _collectedIceCandidates = new();
    private TaskCompletionSource<bool>? _iceGatheringTcs;

    /// <summary>
    /// Optional log action for diagnostic messages.
    /// If null, log messages are silently discarded.
    /// </summary>
    public Action<string>? Log { get; set; }

    /// <summary>
    /// Event fired when tracking data is received
    /// </summary>
    public event Action<TrackingData>? DataReceived;

    /// <summary>
    /// Event fired when an error occurs
    /// </summary>
    public event Action<string>? ErrorOccurred;

    /// <summary>
    /// Event fired when compressed SDP (binary) is ready
    /// </summary>
    public event Action<byte[], bool>? CompressedSdpReady;

    /// <summary>
    /// Event fired when connection state changes
    /// </summary>
    public event Action<RTCPeerConnectionState>? ConnectionStateChanged;

    public WebRTCReceiver(ITrackingDataDeserializer deserializer)
    {
        _deserializer = deserializer ?? throw new ArgumentNullException(nameof(deserializer));
    }

    /// <summary>
    /// Initialize as offerer (PC side generates offer)
    /// </summary>
    public async Task InitializeAsOfferer()
    {
        Log?.Invoke("[WebRTC] Initializing as offerer...");

        try
        {
            var config = new RTCConfiguration
            {
                iceServers = new List<RTCIceServer>
                {
                    new RTCIceServer { urls = "stun:stun.l.google.com:19302" }
                }
            };

            _peerConnection = new RTCPeerConnection(config);
            SetupPeerConnectionHandlers();

            _dataChannel = await _peerConnection.createDataChannel("tracking-data", new RTCDataChannelInit
            {
                ordered = true
            });
            SetupDataChannelHandlers();

            var offer = _peerConnection.createOffer();
            offer.sdp = SanitizeSdp(offer.sdp);
            await _peerConnection.setLocalDescription(offer);

            Log?.Invoke("[WebRTC] Offer created, waiting for ICE gathering...");

            await WaitForIceGathering();

            var compressed = SdpCodec.Encode(offer.sdp, true, _collectedIceCandidates.ToArray());
            Log?.Invoke($"[WebRTC] Compressed offer ready, byte length: {compressed.Length}");

            CompressedSdpReady?.Invoke(compressed, true);
        }
        catch (Exception ex)
        {
            var error = $"Failed to initialize as offerer: {ex.Message}";
            Log?.Invoke($"[WebRTC ERROR] {error}");
            ErrorOccurred?.Invoke(error);
            throw;
        }
    }

    /// <summary>
    /// Initialize as answerer (PC side receives compressed offer from web)
    /// </summary>
    public async Task InitializeAsAnswerer(byte[] offerBytes)
    {
        Log?.Invoke("[WebRTC] Initializing as answerer...");

        try
        {
            // Decode compressed offer
            var (offerSdp, _) = SdpCodec.Decode(offerBytes);
            Log?.Invoke("[WebRTC] Decoded offer SDP");

            var config = new RTCConfiguration
            {
                iceServers = new List<RTCIceServer>
                {
                    new RTCIceServer { urls = "stun:stun.l.google.com:19302" }
                }
            };

            _peerConnection = new RTCPeerConnection(config);
            SetupPeerConnectionHandlers();

            var result = _peerConnection.setRemoteDescription(new RTCSessionDescriptionInit
            {
                type = RTCSdpType.offer,
                sdp = offerSdp
            });

            if (result != SetDescriptionResultEnum.OK)
            {
                throw new Exception($"Failed to set remote description: {result}");
            }

            var answer = _peerConnection.createAnswer();
            answer.sdp = SanitizeSdp(answer.sdp);
            await _peerConnection.setLocalDescription(answer);

            Log?.Invoke("[WebRTC] Answer created, waiting for ICE gathering...");

            await WaitForIceGathering();

            var compressed = SdpCodec.Encode(answer.sdp, false, _collectedIceCandidates.ToArray());
            Log?.Invoke($"[WebRTC] Compressed answer ready, byte length: {compressed.Length}");

            CompressedSdpReady?.Invoke(compressed, false);
        }
        catch (Exception ex)
        {
            var error = $"Failed to initialize as answerer: {ex.Message}";
            Log?.Invoke($"[WebRTC ERROR] {error}");
            ErrorOccurred?.Invoke(error);
            throw;
        }
    }

    /// <summary>
    /// Set remote answer (when PC is offerer, from compressed binary)
    /// </summary>
    public void SetRemoteAnswer(byte[] answerBytes)
    {
        if (_peerConnection == null)
        {
            throw new InvalidOperationException("Peer connection not initialized");
        }

        var (answerSdp, _) = SdpCodec.Decode(answerBytes);
        Log?.Invoke("[WebRTC] Decoded answer SDP");

        var result = _peerConnection.setRemoteDescription(new RTCSessionDescriptionInit
        {
            type = RTCSdpType.answer,
            sdp = answerSdp
        });

        if (result != SetDescriptionResultEnum.OK)
        {
            throw new Exception($"Failed to set remote description: {result}");
        }

        Log?.Invoke("[WebRTC] Remote answer set");
    }

    /// <summary>
    /// Set up peer connection event handlers
    /// </summary>
    private void SetupPeerConnectionHandlers()
    {
        if (_peerConnection == null) return;

        // Reset ICE gathering state
        _collectedIceCandidates.Clear();
        _iceGatheringTcs = new TaskCompletionSource<bool>();

        // ICE candidate event - collect candidates internally
        _peerConnection.onicecandidate += (candidate) =>
        {
            if (candidate != null)
            {
                Log?.Invoke($"[WebRTC] ICE candidate collected: {candidate.candidate}");
                _collectedIceCandidates.Add(candidate.candidate);
            }
            else
            {
                Log?.Invoke("[WebRTC] ICE gathering completed (null candidate)");
                _iceGatheringTcs?.TrySetResult(true);
            }
        };

        // Connection state change
        _peerConnection.onconnectionstatechange += (state) =>
        {
            Log?.Invoke($"[WebRTC] Connection state: {state}");
            ConnectionStateChanged?.Invoke(state);
        };

        // ICE connection state change
        _peerConnection.oniceconnectionstatechange += (state) =>
        {
            Log?.Invoke($"[WebRTC] ICE connection state: {state}");
        };

        // Data channel event (for answerer)
        _peerConnection.ondatachannel += (dc) =>
        {
            Log?.Invoke("[WebRTC] Data channel received");
            _dataChannel = dc;
            SetupDataChannelHandlers();
        };
    }

    /// <summary>
    /// Wait for ICE gathering to complete or timeout
    /// </summary>
    private async Task WaitForIceGathering(int timeoutMs = 10000)
    {
        if (_iceGatheringTcs == null) return;

        var timeoutTask = Task.Delay(timeoutMs);
        var completed = await Task.WhenAny(_iceGatheringTcs.Task, timeoutTask);

        if (completed == timeoutTask)
        {
            Log?.Invoke("[WebRTC] ICE gathering timed out, proceeding with collected candidates");
        }
    }

    /// <summary>
    /// Set up data channel event handlers
    /// </summary>
    private void SetupDataChannelHandlers()
    {
        if (_dataChannel == null) return;

        _dataChannel.onopen += () =>
        {
            Log?.Invoke("[WebRTC] Data channel opened");
        };

        _dataChannel.onclose += () =>
        {
            Log?.Invoke("[WebRTC] Data channel closed");
        };

        _dataChannel.onerror += (error) =>
        {
            Log?.Invoke($"[WebRTC ERROR] Data channel error: {error}");
            ErrorOccurred?.Invoke($"Data channel error: {error}");
        };

        _dataChannel.onmessage += (dc, protocol, data) =>
        {
            try
            {
                TrackingData trackingData;

                if (data.Length > 0)
                {
                    trackingData = _deserializer.Deserialize(data);
                }
                else
                {
                    Log?.Invoke("[WebRTC] Received empty message");
                    return;
                }

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

    /// <summary>
    /// Wait for connection to establish
    /// </summary>
    public async Task WaitForConnection(CancellationToken cancellationToken = default)
    {
        if (_peerConnection == null)
        {
            throw new InvalidOperationException("Peer connection not initialized");
        }

        while (_peerConnection.connectionState != RTCPeerConnectionState.connected &&
               _peerConnection.connectionState != RTCPeerConnectionState.failed &&
               _peerConnection.connectionState != RTCPeerConnectionState.closed)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                break;
            }

            await Task.Delay(100, cancellationToken);
        }

        if (_peerConnection.connectionState == RTCPeerConnectionState.connected)
        {
            Log?.Invoke("[WebRTC] Connection established successfully");
        }
        else
        {
            throw new Exception($"Connection failed. Final state: {_peerConnection.connectionState}");
        }
    }

    /// <summary>
    /// Normalize SDP line endings to \r\n for browser compatibility.
    /// </summary>
    private static string SanitizeSdp(string sdp)
    {
        var lines = sdp.Replace("\r\n", "\n").Replace("\r", "\n")
            .Split('\n')
            .Where(line => line.Length > 0);
        return string.Join("\r\n", lines) + "\r\n";
    }

    /// <summary>
    /// Close connection
    /// </summary>
    public void Close()
    {
        Log?.Invoke("[WebRTC] Closing connection...");

        _dataChannel?.close();
        _peerConnection?.close();

        _dataChannel = null;
        _peerConnection = null;
        _collectedIceCandidates.Clear();
        _iceGatheringTcs = null;
    }

    public void Dispose()
    {
        if (_disposed) return;

        Close();
        _disposed = true;
    }
}
