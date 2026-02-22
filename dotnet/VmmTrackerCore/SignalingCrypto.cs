using System;
using System.Security.Cryptography;

namespace VmmTrackerCore;

public static class SignalingCrypto
{
    /// <summary>
    /// Generate a random AES-128 key (16 bytes)
    /// </summary>
    public static byte[] GenerateKey()
    {
        var key = new byte[SignalingConfig.AesKeySize];
        RandomNumberGenerator.Fill(key);
        return key;
    }

    /// <summary>
    /// Generate a session token (UUID v4)
    /// </summary>
    public static string GenerateToken()
    {
        return Guid.NewGuid().ToString();
    }
}
