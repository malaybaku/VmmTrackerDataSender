/**
 * SDP Compression Codec for WebRTC DataChannel signaling.
 *
 * Compresses SDP + ICE candidates into a compact binary format (71-116 bytes)
 * suitable for QR code / base64 text exchange.
 *
 * Binary format:
 *   [header: 1] [fingerprint: 32] [ufrag_len: 1] [ufrag: U]
 *   [pwd_len: 1] [pwd: P] [candidate_count: 1] [candidates: var]
 *
 * Each candidate:
 *   [flags: 1] [ip: 4|16] [port: 2]
 */

const PROTOCOL_VERSION = 0;

const SDP_TEMPLATE_LINES = [
  'v=0',
  'o=- 0 0 IN IP4 0.0.0.0',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=mid:0',
];

/**
 * Encode SDP + ICE candidates into compact binary.
 */
export function encodeSdp(
  sdp: string,
  type: 'offer' | 'answer',
  iceCandidates: RTCIceCandidate[]
): Uint8Array {
  // Extract fingerprint
  const fpMatch = sdp.match(/a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/);
  if (!fpMatch) throw new Error('No fingerprint found in SDP');
  const fingerprintBytes = hexColonToBytes(fpMatch[1]!);

  // Extract ufrag
  const ufragMatch = sdp.match(/a=ice-ufrag:(.+)/);
  if (!ufragMatch) throw new Error('No ice-ufrag found in SDP');
  const ufrag = ufragMatch[1]!.trim();

  // Extract pwd
  const pwdMatch = sdp.match(/a=ice-pwd:(.+)/);
  if (!pwdMatch) throw new Error('No ice-pwd found in SDP');
  const pwd = pwdMatch[1]!.trim();

  // Filter host candidates and parse IP/port
  const hostCandidates = iceCandidates
    .filter((c) => c.candidate && c.candidate.includes('typ host'))
    .map((c) => parseCandidateLine(c.candidate));

  // Calculate total size
  const ufragBytes = new TextEncoder().encode(ufrag);
  const pwdBytes = new TextEncoder().encode(pwd);
  let size = 1 + 32 + 1 + ufragBytes.length + 1 + pwdBytes.length + 1;
  for (const cand of hostCandidates) {
    size += 1 + (cand.isIPv6 ? 16 : 4) + 2;
  }

  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;

  // Header byte
  const header = (PROTOCOL_VERSION << 5) | (type === 'answer' ? 0x10 : 0x00);
  bytes[offset++] = header;

  // Fingerprint (32 bytes)
  bytes.set(fingerprintBytes, offset);
  offset += 32;

  // ufrag (length-prefixed)
  bytes[offset++] = ufragBytes.length;
  bytes.set(ufragBytes, offset);
  offset += ufragBytes.length;

  // pwd (length-prefixed)
  bytes[offset++] = pwdBytes.length;
  bytes.set(pwdBytes, offset);
  offset += pwdBytes.length;

  // Candidate count
  bytes[offset++] = hostCandidates.length;

  // Candidates
  for (const cand of hostCandidates) {
    bytes[offset++] = cand.isIPv6 ? 0x01 : 0x00;
    bytes.set(cand.ipBytes, offset);
    offset += cand.ipBytes.length;
    view.setUint16(offset, cand.port, false); // big-endian
    offset += 2;
  }

  return bytes;
}

/**
 * Decode compact binary back to a full SDP string.
 */
export function decodeSdp(data: Uint8Array): {
  sdp: string;
  type: 'offer' | 'answer';
} {
  if (data.length < 1) throw new Error('Empty data');

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  // Header byte
  const header = data[offset++]!;
  const version = (header >> 5) & 0x07;
  if (version !== 0) throw new Error(`Unsupported protocol version: ${version}`);
  const sdpType: 'offer' | 'answer' = (header & 0x10) !== 0 ? 'answer' : 'offer';

  // Fingerprint (32 bytes)
  const fpBytes = data.slice(offset, offset + 32);
  offset += 32;
  const fingerprint = bytesToHexColon(fpBytes);

  // ufrag
  const ufragLen = data[offset++]!;
  const ufrag = new TextDecoder().decode(data.slice(offset, offset + ufragLen));
  offset += ufragLen;

  // pwd
  const pwdLen = data[offset++]!;
  const pwd = new TextDecoder().decode(data.slice(offset, offset + pwdLen));
  offset += pwdLen;

  // Candidates
  const candCount = data[offset++]!;
  const candidates: { ip: string; port: number }[] = [];
  for (let i = 0; i < candCount; i++) {
    const flags = data[offset++]!;
    const isIPv6 = (flags & 0x01) !== 0;
    const ipLen = isIPv6 ? 16 : 4;
    const ipBytes = data.slice(offset, offset + ipLen);
    offset += ipLen;
    const port = view.getUint16(offset, false); // big-endian
    offset += 2;
    const ip = isIPv6 ? ipv6BytesToString(ipBytes) : ipv4BytesToString(ipBytes);
    candidates.push({ ip, port });
  }

  // Build SDP
  const setup = sdpType === 'offer' ? 'actpass' : 'active';
  const lines = [
    ...SDP_TEMPLATE_LINES,
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    `a=fingerprint:sha-256 ${fingerprint}`,
    `a=setup:${setup}`,
    'a=sctp-port:5000',
    'a=max-message-size:262144',
  ];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    const priority = (126 << 24) | ((65535 - i) << 8) | 255;
    const foundation = i + 1;
    lines.push(
      `a=candidate:${foundation} 1 udp ${priority >>> 0} ${c.ip} ${c.port} typ host generation 0`
    );
  }

  const sdp = lines.map((l) => l + '\r\n').join('');
  return { sdp, type: sdpType };
}


// ── Internal helpers ──

function hexColonToBytes(hexColon: string): Uint8Array {
  const parts = hexColon.split(':');
  const bytes = new Uint8Array(parts.length);
  for (let i = 0; i < parts.length; i++) {
    bytes[i] = parseInt(parts[i]!, 16);
  }
  return bytes;
}

function bytesToHexColon(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    parts.push(bytes[i]!.toString(16).toUpperCase().padStart(2, '0'));
  }
  return parts.join(':');
}

function parseCandidateLine(candidate: string): {
  isIPv6: boolean;
  ipBytes: Uint8Array;
  port: number;
} {
  // candidate format: "candidate:foundation component protocol priority ip port typ host ..."
  // or with "candidate:" prefix already stripped in some APIs
  const parts = candidate.split(/\s+/);
  // Find the index of "candidate:..." or just start from known positions
  // Standard: candidate:foundation 1 udp priority ip port typ host
  let ipIndex: number;
  let portIndex: number;
  if (parts[0]!.startsWith('candidate:')) {
    ipIndex = 4;
    portIndex = 5;
  } else {
    // "candidate" ":" "foundation" "1" "udp" "priority" "ip" "port" ...
    // Shouldn't happen with RTCIceCandidate.candidate but handle gracefully
    ipIndex = 4;
    portIndex = 5;
  }

  const ipStr = parts[ipIndex]!;
  const port = parseInt(parts[portIndex]!, 10);
  const isIPv6 = ipStr.includes(':');
  const ipBytes = isIPv6 ? ipv6StringToBytes(ipStr) : ipv4StringToBytes(ipStr);

  return { isIPv6, ipBytes, port };
}

function ipv4StringToBytes(ip: string): Uint8Array {
  const parts = ip.split('.');
  return new Uint8Array(parts.map((p) => parseInt(p, 10)));
}

function ipv4BytesToString(bytes: Uint8Array): string {
  return Array.from(bytes).join('.');
}

function ipv6StringToBytes(ip: string): Uint8Array {
  // Expand :: notation
  const halves = ip.split('::');
  let groups: string[];
  if (halves.length === 2) {
    const left = halves[0] ? halves[0]!.split(':') : [];
    const right = halves[1] ? halves[1]!.split(':') : [];
    const missing = 8 - left.length - right.length;
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    groups = ip.split(':');
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const val = parseInt(groups[i]!, 16);
    bytes[i * 2] = (val >> 8) & 0xff;
    bytes[i * 2 + 1] = val & 0xff;
  }
  return bytes;
}

function ipv6BytesToString(bytes: Uint8Array): string {
  const groups: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    const val = (bytes[i]! << 8) | bytes[i + 1]!;
    groups.push(val.toString(16));
  }
  return groups.join(':');
}
