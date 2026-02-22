import { describe, it, expect } from 'vitest';
import { encodeSdp, decodeSdp } from './sdp-codec';

// ── Shared Test Vectors ──
// These exact values must match the C# tests for interoperability.

const TEST_FINGERPRINT_HEX =
  'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:' +
  'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

function buildTestSdp(params: {
  fingerprint: string;
  ufrag: string;
  pwd: string;
}): string {
  return [
    'v=0',
    'o=- 123456 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    'a=mid:0',
    `a=ice-ufrag:${params.ufrag}`,
    `a=ice-pwd:${params.pwd}`,
    `a=fingerprint:sha-256 ${params.fingerprint}`,
    'a=setup:actpass',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
    '',
  ]
    .map((l) => l + '\r\n')
    .join('');
}

function makeCandidate(ip: string, port: number): RTCIceCandidate {
  return {
    candidate: `candidate:1 1 udp 2113937151 ${ip} ${port} typ host generation 0`,
    sdpMid: '0',
    sdpMLineIndex: 0,
    component: null,
    foundation: '1',
    port,
    priority: 2113937151,
    protocol: 'udp',
    relatedAddress: null,
    relatedPort: null,
    tcpType: null,
    type: 'host',
    usernameFragment: null,
    address: ip,
    toJSON() {
      return {};
    },
  } as RTCIceCandidate;
}

// ── Test Vector 1: IPv4 offer, 1 candidate ──
// Expected size: 1 + 32 + 1 + 4 + 1 + 24 + 1 + (1 + 4 + 2) = 71 bytes
const TV1_SDP = buildTestSdp({
  fingerprint: TEST_FINGERPRINT_HEX,
  ufrag: 'abcd',
  pwd: 'aabbccddee112233aabbccdd',
});
const TV1_CANDIDATES = [makeCandidate('192.168.1.100', 12345)];
const TV1_EXPECTED_BYTES = new Uint8Array([
  // header: offer, version 0
  0x00,
  // fingerprint (32 bytes)
  0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
  0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11,
  0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
  // ufrag length + "abcd"
  0x04, 0x61, 0x62, 0x63, 0x64,
  // pwd length + "aabbccddee112233aabbccdd"
  0x18, 0x61, 0x61, 0x62, 0x62, 0x63, 0x63, 0x64, 0x64, 0x65, 0x65, 0x31,
  0x31, 0x32, 0x32, 0x33, 0x33, 0x61, 0x61, 0x62, 0x62, 0x63, 0x63, 0x64,
  0x64,
  // candidate count
  0x01,
  // candidate 1: IPv4 flag, 192.168.1.100, port 12345 (0x3039)
  0x00, 0xc0, 0xa8, 0x01, 0x64, 0x30, 0x39,
]);

// ── Test Vector 2: IPv4 answer, 2 candidates ──
// Expected size: 1 + 32 + 1 + 4 + 1 + 24 + 1 + 2*(1 + 4 + 2) = 78 bytes
const TV2_SDP = buildTestSdp({
  fingerprint: TEST_FINGERPRINT_HEX,
  ufrag: 'abcd',
  pwd: 'aabbccddee112233aabbccdd',
});
const TV2_CANDIDATES = [
  makeCandidate('192.168.1.100', 12345),
  makeCandidate('10.0.0.1', 54321),
];
const TV2_EXPECTED_BYTES = new Uint8Array([
  // header: answer
  0x10,
  // fingerprint (32 bytes)
  0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
  0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11,
  0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
  // ufrag length + "abcd"
  0x04, 0x61, 0x62, 0x63, 0x64,
  // pwd length + "aabbccddee112233aabbccdd"
  0x18, 0x61, 0x61, 0x62, 0x62, 0x63, 0x63, 0x64, 0x64, 0x65, 0x65, 0x31,
  0x31, 0x32, 0x32, 0x33, 0x33, 0x61, 0x61, 0x62, 0x62, 0x63, 0x63, 0x64,
  0x64,
  // candidate count
  0x02,
  // candidate 1: IPv4, 192.168.1.100:12345
  0x00, 0xc0, 0xa8, 0x01, 0x64, 0x30, 0x39,
  // candidate 2: IPv4, 10.0.0.1:54321 (0xD431)
  0x00, 0x0a, 0x00, 0x00, 0x01, 0xd4, 0x31,
]);

// ── Test Vector 3: IPv6 candidate ──
// Expected size: 1 + 32 + 1 + 4 + 1 + 24 + 1 + (1 + 16 + 2) = 83 bytes
const TV3_SDP = buildTestSdp({
  fingerprint: TEST_FINGERPRINT_HEX,
  ufrag: 'abcd',
  pwd: 'aabbccddee112233aabbccdd',
});
const TV3_CANDIDATES = [makeCandidate('fe80::1', 9999)];
const TV3_EXPECTED_BYTES = new Uint8Array([
  // header: offer
  0x00,
  // fingerprint (32 bytes)
  0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
  0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11,
  0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
  // ufrag length + "abcd"
  0x04, 0x61, 0x62, 0x63, 0x64,
  // pwd length + "aabbccddee112233aabbccdd"
  0x18, 0x61, 0x61, 0x62, 0x62, 0x63, 0x63, 0x64, 0x64, 0x65, 0x65, 0x31,
  0x31, 0x32, 0x32, 0x33, 0x33, 0x61, 0x61, 0x62, 0x62, 0x63, 0x63, 0x64,
  0x64,
  // candidate count
  0x01,
  // candidate 1: IPv6 flag, fe80::1, port 9999 (0x270F)
  0x01, 0xfe, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x27, 0x0f,
]);

describe('SDP Codec', () => {
  describe('encodeSdp', () => {
    it('should encode IPv4 offer (TV1) to expected binary', () => {
      const result = encodeSdp(TV1_SDP, 'offer', TV1_CANDIDATES);
      expect(result).toEqual(TV1_EXPECTED_BYTES);
      expect(result.length).toBe(71);
    });

    it('should encode IPv4 answer with 2 candidates (TV2) to expected binary', () => {
      const result = encodeSdp(TV2_SDP, 'answer', TV2_CANDIDATES);
      expect(result).toEqual(TV2_EXPECTED_BYTES);
      expect(result.length).toBe(78);
    });

    it('should encode IPv6 candidate (TV3) to expected binary', () => {
      const result = encodeSdp(TV3_SDP, 'offer', TV3_CANDIDATES);
      expect(result).toEqual(TV3_EXPECTED_BYTES);
      expect(result.length).toBe(83);
    });

    it('should filter non-host candidates', () => {
      const candidates = [
        makeCandidate('192.168.1.100', 12345),
        {
          candidate:
            'candidate:2 1 udp 1677729535 203.0.113.1 54321 typ srflx raddr 192.168.1.100 rport 12345 generation 0',
          sdpMid: '0',
          sdpMLineIndex: 0,
          toJSON() {
            return {};
          },
        } as RTCIceCandidate,
      ];
      const result = encodeSdp(TV1_SDP, 'offer', candidates);
      // Should only include the host candidate
      expect(result).toEqual(TV1_EXPECTED_BYTES);
    });
  });

  describe('decodeSdp', () => {
    it('should decode TV1 to valid SDP with correct fields', () => {
      const { sdp, type } = decodeSdp(TV1_EXPECTED_BYTES);
      expect(type).toBe('offer');
      expect(sdp).toContain('a=ice-ufrag:abcd\r\n');
      expect(sdp).toContain('a=ice-pwd:aabbccddee112233aabbccdd\r\n');
      expect(sdp).toContain(
        `a=fingerprint:sha-256 ${TEST_FINGERPRINT_HEX}\r\n`
      );
      expect(sdp).toContain('a=setup:actpass\r\n');
      expect(sdp).toContain('a=sctp-port:5000\r\n');
      expect(sdp).toContain('a=max-message-size:262144\r\n');
      expect(sdp).toContain('a=group:BUNDLE 0\r\n');
      expect(sdp).toContain('192.168.1.100 12345 typ host');
    });

    it('should decode TV2 as answer with setup:active', () => {
      const { sdp, type } = decodeSdp(TV2_EXPECTED_BYTES);
      expect(type).toBe('answer');
      expect(sdp).toContain('a=setup:active\r\n');
      expect(sdp).toContain('192.168.1.100 12345 typ host');
      expect(sdp).toContain('10.0.0.1 54321 typ host');
    });

    it('should decode TV3 with IPv6 candidate', () => {
      const { sdp, type } = decodeSdp(TV3_EXPECTED_BYTES);
      expect(type).toBe('offer');
      expect(sdp).toContain('fe80:0:0:0:0:0:0:1 9999 typ host');
    });

    it('should use \\r\\n line endings throughout', () => {
      const { sdp } = decodeSdp(TV1_EXPECTED_BYTES);
      // All lines should have been split by \r\n (no standalone \n)
      expect(sdp).not.toMatch(/[^\r]\n/);
      // Should end with \r\n
      expect(sdp.endsWith('\r\n')).toBe(true);
    });

    it('should throw on unsupported version', () => {
      const badData = new Uint8Array(TV1_EXPECTED_BYTES);
      badData[0] = 0xe0; // version 7
      expect(() => decodeSdp(badData)).toThrow('Unsupported protocol version');
    });

    it('should throw on empty data', () => {
      expect(() => decodeSdp(new Uint8Array(0))).toThrow();
    });

    it('should produce correct candidate priority and foundation', () => {
      const { sdp } = decodeSdp(TV2_EXPECTED_BYTES);
      // candidate 1: foundation=1, priority = (126<<24)|((65535-0)<<8)|255 = 2130706431
      expect(sdp).toContain(
        'a=candidate:1 1 udp 2130706431 192.168.1.100 12345 typ host generation 0'
      );
      // candidate 2: foundation=2, priority = (126<<24)|((65535-1)<<8)|255 = 2130706175
      expect(sdp).toContain(
        'a=candidate:2 1 udp 2130706175 10.0.0.1 54321 typ host generation 0'
      );
    });
  });

  describe('encode → decode roundtrip', () => {
    it('should roundtrip TV1 (offer)', () => {
      const encoded = encodeSdp(TV1_SDP, 'offer', TV1_CANDIDATES);
      const { sdp, type } = decodeSdp(encoded);
      expect(type).toBe('offer');
      expect(sdp).toContain(`a=fingerprint:sha-256 ${TEST_FINGERPRINT_HEX}`);
      expect(sdp).toContain('a=ice-ufrag:abcd');
      expect(sdp).toContain('a=ice-pwd:aabbccddee112233aabbccdd');
      expect(sdp).toContain('192.168.1.100 12345 typ host');
    });

    it('should roundtrip TV2 (answer)', () => {
      const encoded = encodeSdp(TV2_SDP, 'answer', TV2_CANDIDATES);
      const { sdp, type } = decodeSdp(encoded);
      expect(type).toBe('answer');
      expect(sdp).toContain('a=setup:active');
    });

    it('should roundtrip TV3 (IPv6)', () => {
      const encoded = encodeSdp(TV3_SDP, 'offer', TV3_CANDIDATES);
      const { sdp, type } = decodeSdp(encoded);
      expect(type).toBe('offer');
      expect(sdp).toContain('9999 typ host');
    });
  });

});
