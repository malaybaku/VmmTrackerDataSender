using System;
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

    /// <summary>
    /// Event fired when tracking data is received
    /// </summary>
    public event Action<TrackingData>? DataReceived;

    /// <summary>
    /// Event fired when an error occurs
    /// </summary>
    public event Action<string>? ErrorOccurred;

    /// <summary>
    /// Event fired when offer SDP is generated
    /// </summary>
    public event Action<string>? OfferGenerated;

    /// <summary>
    /// Event fired when answer SDP is generated
    /// </summary>
    public event Action<string>? AnswerGenerated;

    /// <summary>
    /// Event fired when ICE candidate is generated
    /// </summary>
    public event Action<RTCIceCandidate>? IceCandidateGenerated;

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
            // Create peer connection with STUN server
            var config = new RTCConfiguration
            {
                iceServers = new System.Collections.Generic.List<RTCIceServer>
                {
                    new RTCIceServer { urls = "stun:stun.l.google.com:19302" }
                }
            };

            _peerConnection = new RTCPeerConnection(config);

            // Set up event handlers
            SetupPeerConnectionHandlers();

            // Create data channel
            _dataChannel = await _peerConnection.createDataChannel("tracking-data", new RTCDataChannelInit
            {
                ordered = true
            });

            // Set up data channel handlers
            SetupDataChannelHandlers();

            // Create offer
            var offer = _peerConnection.createOffer();
            await _peerConnection.setLocalDescription(offer);

            Console.WriteLine("[WebRTC] Offer SDP generated");
            Console.WriteLine("--- Offer SDP Start ---");
            Console.WriteLine(offer.sdp);
            Console.WriteLine("--- Offer SDP End ---");
            Console.WriteLine();

            OfferGenerated?.Invoke(offer.sdp);
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
    /// Initialize as answerer (PC side receives offer from web)
    /// </summary>
    public async Task InitializeAsAnswerer(string offerSdp)
    {
        Console.WriteLine("[WebRTC] Initializing as answerer...");

        try
        {
            // Create peer connection with STUN server
            var config = new RTCConfiguration
            {
                iceServers = new System.Collections.Generic.List<RTCIceServer>
                {
                    new RTCIceServer { urls = "stun:stun.l.google.com:19302" }
                }
            };

            _peerConnection = new RTCPeerConnection(config);

            // Set up event handlers
            SetupPeerConnectionHandlers();

            // Set remote description (offer)
            var result = _peerConnection.setRemoteDescription(new RTCSessionDescriptionInit
            {
                type = RTCSdpType.offer,
                sdp = offerSdp
            });

            if (result != SetDescriptionResultEnum.OK)
            {
                throw new Exception($"Failed to set remote description: {result}");
            }

            // Create answer
            var answer = _peerConnection.createAnswer();
            await _peerConnection.setLocalDescription(answer);

            Console.WriteLine("[WebRTC] Answer SDP generated");
            Console.WriteLine("--- Answer SDP Start ---");
            Console.WriteLine(answer.sdp);
            Console.WriteLine("--- Answer SDP End ---");
            Console.WriteLine();

            AnswerGenerated?.Invoke(answer.sdp);
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
    /// Set remote answer (when PC is offerer)
    /// </summary>
    public void SetRemoteAnswer(string answerSdp)
    {
        if (_peerConnection == null)
        {
            throw new InvalidOperationException("Peer connection not initialized");
        }

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
    /// Add ICE candidate from remote peer
    /// </summary>
    public void AddIceCandidate(RTCIceCandidateInit candidate)
    {
        if (_peerConnection == null)
        {
            throw new InvalidOperationException("Peer connection not initialized");
        }

        _peerConnection.addIceCandidate(candidate);
        Console.WriteLine($"[WebRTC] ICE candidate added: {candidate.candidate}");
    }

    /// <summary>
    /// Set up peer connection event handlers
    /// </summary>
    private void SetupPeerConnectionHandlers()
    {
        if (_peerConnection == null) return;

        // ICE candidate event
        _peerConnection.onicecandidate += (candidate) =>
        {
            if (candidate != null)
            {
                Console.WriteLine($"[WebRTC] ICE candidate: {candidate.candidate}");
                IceCandidateGenerated?.Invoke(candidate);
            }
            else
            {
                Console.WriteLine("[WebRTC] ICE gathering completed");
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

                // Deserialize based on data type
                if (data.Length > 0)
                {
                    // Binary data (compressed format)
                    trackingData = _deserializer.Deserialize(data);
                }
                else
                {
                    // Should not happen, but handle gracefully
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
    /// Close connection
    /// </summary>
    public void Close()
    {
        Console.WriteLine("[WebRTC] Closing connection...");

        _dataChannel?.close();
        _peerConnection?.close();

        _dataChannel = null;
        _peerConnection = null;
    }

    public void Dispose()
    {
        if (_disposed) return;

        Close();
        _disposed = true;
    }
}
