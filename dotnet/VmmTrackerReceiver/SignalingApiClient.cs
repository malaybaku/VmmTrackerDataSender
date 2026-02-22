using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace VmmTrackerReceiver;

public class SignalingApiClient : IDisposable
{
    private readonly HttpClient _httpClient;
    private bool _disposed;

    public SignalingApiClient()
    {
        _httpClient = new HttpClient();
    }

    /// <summary>
    /// Poll Firebase API for the answer.
    /// Returns the answer string (base64 of encrypted data) when available.
    /// Throws on timeout or cancellation.
    /// </summary>
    public async Task<string> PollForAnswer(
        string token,
        CancellationToken cancellationToken = default,
        int intervalMs = SignalingConfig.PollIntervalMs,
        int timeoutMs = SignalingConfig.PollTimeoutMs)
    {
        var url = $"{SignalingConfig.ApiBaseUrl}/{Uri.EscapeDataString(token)}";
        var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);

        while (DateTime.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var response = await _httpClient.GetAsync(url, cancellationToken);

                if (response.StatusCode == System.Net.HttpStatusCode.OK)
                {
                    var json = await response.Content.ReadAsStringAsync(cancellationToken);
                    using var doc = JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("answer", out var answerElement))
                    {
                        var answer = answerElement.GetString();
                        if (!string.IsNullOrEmpty(answer))
                        {
                            return answer;
                        }
                    }
                }
                // 404 or no answer yet → continue polling
            }
            catch (HttpRequestException ex)
            {
                Console.WriteLine($"[Signaling] Poll request failed: {ex.Message}");
            }

            await Task.Delay(intervalMs, cancellationToken);
        }

        throw new TimeoutException($"No answer received within {timeoutMs / 1000} seconds");
    }

    public void Dispose()
    {
        if (_disposed) return;
        _httpClient.Dispose();
        _disposed = true;
    }
}
