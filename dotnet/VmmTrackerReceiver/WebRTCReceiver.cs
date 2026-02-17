using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using SIPSorcery.Net;
using VmmTrackerCore;

namespace VmmTrackerReceiver;

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
    /// Event fired when tracking data is received
    /// </summary>
    public event Action<TrackingData>? DataReceived;

    /// <summary>
    /// Event fired when an error occurs
    /// </summary>
    public event Action<string>? ErrorOccurred;

    /// <summary>
    /// Event fired when compressed SDP (base64) is ready
    /// </summary>
    public event Action<string, bool>? CompressedSdpReady;

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
        Console.WriteLine("[WebRTC] Initializing as offerer...");

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

            Console.WriteLine("[WebRTC] Offer created, waiting for ICE gathering...");

            await WaitForIceGathering();

            var compressed = SdpCodec.Encode(offer.sdp, true, _collectedIceCandidates.ToArray());
            var base64 = SdpCodec.ToBase64(compressed);
            Console.WriteLine($"[WebRTC] Compressed offer ready, base64 length: {base64.Length}");

            CompressedSdpReady?.Invoke(base64, true);
        }
        catch (Exception ex)
        {
            var error = $"Failed to initialize as offerer: {ex.Message}";
            Console.WriteLine($"[WebRTC ERROR] {error}");
            ErrorOccurred?.Invoke(error);
            throw;
        }
    }

    /// <summary>
    /// Initialize as answerer (PC side receives compressed offer from web)
    /// </summary>
    public async Task InitializeAsAnswerer(string offerBase64)
    {
        Console.WriteLine("[WebRTC] Initializing as answerer...");

        try
        {
            // Decode compressed offer
            var offerBytes = SdpCodec.FromBase64(offerBase64);
            var (offerSdp, _) = SdpCodec.Decode(offerBytes);
            Console.WriteLine("[WebRTC] Decoded offer SDP from base64");

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

            Console.WriteLine("[WebRTC] Answer created, waiting for ICE gathering...");

            await WaitForIceGathering();

            var compressed = SdpCodec.Encode(answer.sdp, false, _collectedIceCandidates.ToArray());
            var base64 = SdpCodec.ToBase64(compressed);
            Console.WriteLine($"[WebRTC] Compressed answer ready, base64 length: {base64.Length}");

            CompressedSdpReady?.Invoke(base64, false);
        }
        catch (Exception ex)
        {
            var error = $"Failed to initialize as answerer: {ex.Message}";
            Console.WriteLine($"[WebRTC ERROR] {error}");
            ErrorOccurred?.Invoke(error);
            throw;
        }
    }

    /// <summary>
    /// Set remote answer (when PC is offerer, from compressed base64)
    /// </summary>
    public void SetRemoteAnswer(string answerBase64)
    {
        if (_peerConnection == null)
        {
            throw new InvalidOperationException("Peer connection not initialized");
        }

        var answerBytes = SdpCodec.FromBase64(answerBase64);
        var (answerSdp, _) = SdpCodec.Decode(answerBytes);
        Console.WriteLine("[WebRTC] Decoded answer SDP from base64");

        var result = _peerConnection.setRemoteDescription(new RTCSessionDescriptionInit
        {
            type = RTCSdpType.answer,
            sdp = answerSdp
        });

        if (result != SetDescriptionResultEnum.OK)
        {
            throw new Exception($"Failed to set remote description: {result}");
        }

        Console.WriteLine("[WebRTC] Remote answer set");
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
                Console.WriteLine($"[WebRTC] ICE candidate collected: {candidate.candidate}");
                _collectedIceCandidates.Add(candidate.candidate);
            }
            else
            {
                Console.WriteLine("[WebRTC] ICE gathering completed (null candidate)");
                _iceGatheringTcs?.TrySetResult(true);
            }
        };

        // Connection state change
        _peerConnection.onconnectionstatechange += (state) =>
        {
            Console.WriteLine($"[WebRTC] Connection state: {state}");
            ConnectionStateChanged?.Invoke(state);
        };

        // ICE connection state change
        _peerConnection.oniceconnectionstatechange += (state) =>
        {
            Console.WriteLine($"[WebRTC] ICE connection state: {state}");
        };

        // Data channel event (for answerer)
        _peerConnection.ondatachannel += (dc) =>
        {
            Console.WriteLine("[WebRTC] Data channel received");
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
            Console.WriteLine("[WebRTC] ICE gathering timed out, proceeding with collected candidates");
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
            Console.WriteLine("[WebRTC] Data channel opened");
        };

        _dataChannel.onclose += () =>
        {
            Console.WriteLine("[WebRTC] Data channel closed");
        };

        _dataChannel.onerror += (error) =>
        {
            Console.WriteLine($"[WebRTC ERROR] Data channel error: {error}");
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
                    Console.WriteLine("[WebRTC] Received empty message");
                    return;
                }

                DataReceived?.Invoke(trackingData);
            }
            catch (Exception ex)
            {
                var error = $"Failed to deserialize data: {ex.Message}";
                Console.WriteLine($"[WebRTC ERROR] {error}");
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
            Console.WriteLine("[WebRTC] Connection established successfully");
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
        Console.WriteLine("[WebRTC] Closing connection...");

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
