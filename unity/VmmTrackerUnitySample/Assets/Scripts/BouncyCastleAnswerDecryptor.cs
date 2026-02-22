using System;
using Org.BouncyCastle.Crypto.Engines;
using Org.BouncyCastle.Crypto.Modes;
using Org.BouncyCastle.Crypto.Parameters;
using VmmTrackerCore;

/// <summary>
/// AES-128-GCM decryptor using BouncyCastle.
/// Unity Mono does not support System.Security.Cryptography.AesGcm,
/// so this uses BouncyCastle (Portable.BouncyCastle 1.9.0) as an alternative.
/// </summary>
public class BouncyCastleAnswerDecryptor : IAnswerDecryptor
{
    public byte[] Decrypt(byte[] key, byte[] encryptedData)
    {
        if (encryptedData.Length < SignalingConfig.AesIvSize + SignalingConfig.AesTagSize)
        {
            throw new ArgumentException("Encrypted data is too short");
        }

        // Extract IV (first 12 bytes)
        var iv = new byte[SignalingConfig.AesIvSize];
        Buffer.BlockCopy(encryptedData, 0, iv, 0, SignalingConfig.AesIvSize);

        // BouncyCastle GCM decryption expects ciphertext || authTag as input
        var ciphertextWithTag = new byte[encryptedData.Length - SignalingConfig.AesIvSize];
        Buffer.BlockCopy(encryptedData, SignalingConfig.AesIvSize, ciphertextWithTag, 0, ciphertextWithTag.Length);

        var cipher = new GcmBlockCipher(new AesEngine());
        cipher.Init(false, new AeadParameters(
            new KeyParameter(key),
            SignalingConfig.AesTagSize * 8, // tag size in bits
            iv
        ));

        var output = new byte[cipher.GetOutputSize(ciphertextWithTag.Length)];
        var len = cipher.ProcessBytes(ciphertextWithTag, 0, ciphertextWithTag.Length, output, 0);
        len += cipher.DoFinal(output, len);

        var result = new byte[len];
        Buffer.BlockCopy(output, 0, result, 0, len);
        return result;
    }
}
