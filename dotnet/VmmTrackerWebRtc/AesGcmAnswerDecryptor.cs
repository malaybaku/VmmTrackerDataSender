using System;
using System.Security.Cryptography;
using VmmTrackerCore;

namespace VmmTrackerWebRtc;

/// <summary>
/// AES-128-GCM implementation of IAnswerDecryptor.
/// Requires .NET Core 3.0+ (not available in .NET Standard 2.1 runtimes without AesGcm support).
/// </summary>
public class AesGcmAnswerDecryptor : IAnswerDecryptor
{
    public byte[] Decrypt(byte[] key, byte[] encryptedData)
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
