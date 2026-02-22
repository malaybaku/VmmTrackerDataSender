namespace VmmTrackerCore;

/// <summary>
/// Interface for decrypting the encrypted answer received from the signaling API.
/// The encrypted data layout is: IV[12] || ciphertext[N] || authTag[16] (AES-128-GCM).
/// </summary>
public interface IAnswerDecryptor
{
    /// <summary>
    /// Decrypt the encrypted answer data.
    /// </summary>
    /// <param name="key">AES-128 key (16 bytes)</param>
    /// <param name="encryptedData">IV[12] || ciphertext[N] || authTag[16]</param>
    /// <returns>Decrypted plaintext (compressed SDP answer)</returns>
    byte[] Decrypt(byte[] key, byte[] encryptedData);
}
