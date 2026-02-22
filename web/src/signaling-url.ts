import { AES_KEY_SIZE } from './signaling-config';

/**
 * Encode bytes to base64url (RFC 4648 §5, no padding)
 */
export function base64urlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode base64url (RFC 4648 §5, no padding) to bytes
 */
export function base64urlDecode(str: string): Uint8Array {
  // Restore standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parse URL fragment: <token>.<base64url(key + offer)>
 * Returns null if the fragment is invalid.
 */
export function parseFragment(hash: string): { token: string; aesKey: Uint8Array; offerBytes: Uint8Array } | null {
  // Remove leading '#'
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!fragment) return null;

  const dotIndex = fragment.indexOf('.');
  if (dotIndex < 1) return null;

  const token = fragment.slice(0, dotIndex);
  const payloadB64 = fragment.slice(dotIndex + 1);
  if (!payloadB64) return null;

  // Validate token format (UUID-like: alphanumeric + hyphens)
  if (!/^[a-zA-Z0-9-]+$/.test(token)) return null;

  try {
    const payload = base64urlDecode(payloadB64);
    if (payload.length <= AES_KEY_SIZE) return null;

    const aesKey = payload.slice(0, AES_KEY_SIZE);
    const offerBytes = payload.slice(AES_KEY_SIZE);

    return { token, aesKey, offerBytes };
  } catch {
    return null;
  }
}
