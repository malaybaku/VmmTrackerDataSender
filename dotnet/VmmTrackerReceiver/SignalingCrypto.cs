using System;
using System.Security.Cryptography;

namespace VmmTrackerReceiver;

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

    /// <summary>
    /// Decrypt AES-128-GCM encrypted data.
    /// Input layout: IV[12] || ciphertext[N] || authTag[16]
    /// </summary>
    public static byte[] Decrypt(byte[] key, byte[] encryptedData)
    {
        if (encryptedData.Length < SignalingConfig.AesIvSize + SignalingConfig.AesTagSize)
        {
            throw new ArgumentException("Encrypted data is too short");
        }

        var iv = new byte[SignalingConfig.AesIvSize];
        Buffer.BlockCopy(encryptedData, 0, iv, 0, SignalingConfig.AesIvSize);

        var tagOffset = encryptedData.Length - SignalingConfig.AesTagSize;
        var ciphertextLength = tagOffset - SignalingConfig.AesIvSize;

        var ciphertext = new byte[ciphertextLength];
        Buffer.BlockCopy(encryptedData, SignalingConfig.AesIvSize, ciphertext, 0, ciphertextLength);

        var tag = new byte[SignalingConfig.AesTagSize];
        Buffer.BlockCopy(encryptedData, tagOffset, tag, 0, SignalingConfig.AesTagSize);

        var plaintext = new byte[ciphertextLength];
        using var aes = new AesGcm(key, SignalingConfig.AesTagSize);
        aes.Decrypt(iv, ciphertext, tag, plaintext);

        return plaintext;
    }
}
