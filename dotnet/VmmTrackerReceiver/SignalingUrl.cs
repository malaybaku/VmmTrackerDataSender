using System;

namespace VmmTrackerReceiver;

public static class SignalingUrl
{
    /// <summary>
    /// Build the signaling URL with fragment: WebBaseUrl#token.base64url(key + offer)
    /// </summary>
    public static string BuildUrl(string token, byte[] aesKey, byte[] compressedOffer)
    {
        var payload = new byte[aesKey.Length + compressedOffer.Length];
        Buffer.BlockCopy(aesKey, 0, payload, 0, aesKey.Length);
        Buffer.BlockCopy(compressedOffer, 0, payload, aesKey.Length, compressedOffer.Length);

        var encoded = Base64UrlEncode(payload);
        return $"{SignalingConfig.WebBaseUrl}#{token}.{encoded}";
    }

    /// <summary>
    /// Encode bytes to base64url (RFC 4648 §5, no padding)
    /// </summary>
    public static string Base64UrlEncode(byte[] data)
    {
        return Convert.ToBase64String(data)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    /// <summary>
    /// Decode base64url (RFC 4648 §5, no padding) to bytes
    /// </summary>
    public static byte[] Base64UrlDecode(string str)
    {
        var base64 = str.Replace('-', '+').Replace('_', '/');
        var pad = base64.Length % 4;
        if (pad == 2) base64 += "==";
        else if (pad == 3) base64 += "=";
        return Convert.FromBase64String(base64);
    }
}
