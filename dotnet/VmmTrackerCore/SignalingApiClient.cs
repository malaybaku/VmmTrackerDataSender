using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace VmmTrackerCore;

public class SignalingApiClient : IDisposable
{
    private readonly HttpClient _httpClient;
    private bool _disposed;

    public SignalingApiClient()
    {
        _httpClient = new HttpClient();
    }

    /// <summary>
    /// Fetch the answer from Firebase API.
    /// Returns the answer string (base64 of encrypted data) if available, or null if not yet posted.
    /// </summary>
    public async Task<string?> GetAnswerAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        var url = $"{SignalingConfig.ApiBaseUrl}/{Uri.EscapeDataString(token)}";

        var response = await _httpClient.GetAsync(url, cancellationToken);

        if (response.StatusCode != System.Net.HttpStatusCode.OK)
        {
            return null;
        }

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.TryGetProperty("answer", out var answerElement))
        {
            var answer = answerElement.GetString();
            if (!string.IsNullOrEmpty(answer))
            {
                return answer;
            }
        }

        return null;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _httpClient.Dispose();
        _disposed = true;
    }
}
