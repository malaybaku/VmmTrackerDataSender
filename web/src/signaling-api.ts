import { API_BASE_URL } from './signaling-config';

/**
 * PUT encrypted answer to Firebase API.
 * Body: { "answer": "<base64 of encrypted data>" }
 */
export async function putAnswer(token: string, encryptedBase64: string): Promise<void> {
  const url = `${API_BASE_URL}/${encodeURIComponent(token)}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: encryptedBase64 }),
  });

  if (!response.ok) {
    throw new Error(`PUT /session/${token} failed: ${response.status} ${response.statusText}`);
  }
}
