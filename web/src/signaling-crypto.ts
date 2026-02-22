import { AES_IV_SIZE } from './signaling-config';

/**
 * Encrypt answer bytes using AES-128-GCM.
 * Returns: IV[12] || ciphertext[N] || authTag[16]
 */
export async function encryptAnswer(key: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_SIZE));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Web Crypto encrypt returns ciphertext || authTag (16 bytes)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer.slice(0, AES_IV_SIZE) as ArrayBuffer, tagLength: 128 },
    cryptoKey,
    plaintext.buffer.slice(plaintext.byteOffset, plaintext.byteOffset + plaintext.byteLength) as ArrayBuffer
  );

  // Prepend IV: IV[12] || ciphertext || authTag[16]
  const result = new Uint8Array(AES_IV_SIZE + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), AES_IV_SIZE);

  return result;
}
