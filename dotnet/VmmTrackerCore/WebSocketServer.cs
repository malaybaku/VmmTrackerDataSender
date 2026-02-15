using System;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace VmmTrackerCore;

/// <summary>
/// Simple WebSocket server for receiving tracking data
/// </summary>
public class WebSocketServer : IDisposable
{
    private readonly HttpListener _httpListener;
    private readonly ITrackingDataDeserializer _deserializer;
    private CancellationTokenSource? _cts;
    private bool _isRunning;

    public event Action<TrackingData>? DataReceived;
    public event Action<string>? ErrorOccurred;

    public WebSocketServer(int port, ITrackingDataDeserializer deserializer)
    {
        _deserializer = deserializer ?? throw new ArgumentNullException(nameof(deserializer));
        _httpListener = new HttpListener();
        _httpListener.Prefixes.Add($"http://localhost:{port}/");
    }

    public void Start()
    {
        if (_isRunning)
        {
            throw new InvalidOperationException("Server is already running");
        }

        _httpListener.Start();
        _cts = new CancellationTokenSource();
        _isRunning = true;

        Task.Run(() => AcceptClientsAsync(_cts.Token));
    }

    public void Stop()
    {
        if (!_isRunning) return;

        _cts?.Cancel();
        _httpListener.Stop();
        _isRunning = false;
    }

    private async Task AcceptClientsAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var context = await _httpListener.GetContextAsync();

                if (context.Request.IsWebSocketRequest)
                {
                    var wsContext = await context.AcceptWebSocketAsync(null);
                    _ = HandleClientAsync(wsContext.WebSocket, cancellationToken);
                }
                else
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                }
            }
            catch (HttpListenerException)
            {
                // Listener stopped
                break;
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke($"Error accepting client: {ex.Message}");
            }
        }
    }

    private async Task HandleClientAsync(WebSocket webSocket, CancellationToken cancellationToken)
    {
        var buffer = new byte[8192];

        try
        {
            while (webSocket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
            {
                var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", cancellationToken);
                    break;
                }

                if (result.MessageType == WebSocketMessageType.Binary)
                {
                    var data = new byte[result.Count];
                    Array.Copy(buffer, data, result.Count);

                    try
                    {
                        var trackingData = _deserializer.Deserialize(data);
                        DataReceived?.Invoke(trackingData);
                    }
                    catch (Exception ex)
                    {
                        ErrorOccurred?.Invoke($"Deserialization error: {ex.Message}");
                    }
                }
                else if (result.MessageType == WebSocketMessageType.Text)
                {
                    var text = Encoding.UTF8.GetString(buffer, 0, result.Count);

                    try
                    {
                        var trackingData = _deserializer.Deserialize(text);
                        DataReceived?.Invoke(trackingData);
                    }
                    catch (Exception ex)
                    {
                        ErrorOccurred?.Invoke($"Deserialization error: {ex.Message}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            ErrorOccurred?.Invoke($"Error handling client: {ex.Message}");
        }
        finally
        {
            webSocket.Dispose();
        }
    }

    public void Dispose()
    {
        Stop();
        _httpListener.Close();
        _cts?.Dispose();
    }
}
