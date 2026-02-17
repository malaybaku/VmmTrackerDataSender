using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Net;
using System.Text;

namespace VmmTrackerCore;

/// <summary>
/// SDP Compression Codec for WebRTC DataChannel signaling.
///
/// Compresses SDP + ICE candidates into a compact binary format (71-116 bytes)
/// suitable for QR code / base64 text exchange.
///
/// Binary format:
///   [header: 1] [fingerprint: 32] [ufrag_len: 1] [ufrag: U]
///   [pwd_len: 1] [pwd: P] [candidate_count: 1] [candidates: var]
///
/// Each candidate:
///   [flags: 1] [ip: 4|16] [port: 2]
/// </summary>
public static class SdpCodec
{
    private const int ProtocolVersion = 0;

    private static readonly string[] SdpTemplateLines = new[]
    {
        "v=0",
        "o=- 0 0 IN IP4 0.0.0.0",
        "s=-",
        "t=0 0",
        "a=group:BUNDLE 0",
        "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
        "c=IN IP4 0.0.0.0",
        "a=mid:0",
    };

    /// <summary>
    /// Encode SDP + ICE candidate lines into compact binary.
    /// </summary>
    /// <param name="sdp">Full SDP text</param>
    /// <param name="isOffer">true for offer, false for answer</param>
    /// <param name="iceCandidateLines">Raw ICE candidate attribute lines (a=candidate:...)</param>
    public static byte[] Encode(string sdp, bool isOffer, string[] iceCandidateLines)
    {
        // Extract fingerprint
        var fpMatch = System.Text.RegularExpressions.Regex.Match(sdp, @"a=fingerprint:sha-256 ([0-9A-Fa-f:]+)");
        if (!fpMatch.Success) throw new ArgumentException("No fingerprint found in SDP");
        byte[] fingerprintBytes = HexColonToBytes(fpMatch.Groups[1].Value);

        // Extract ufrag
        var ufragMatch = System.Text.RegularExpressions.Regex.Match(sdp, @"a=ice-ufrag:(.+)");
        if (!ufragMatch.Success) throw new ArgumentException("No ice-ufrag found in SDP");
        string ufrag = ufragMatch.Groups[1].Value.Trim();

        // Extract pwd
        var pwdMatch = System.Text.RegularExpressions.Regex.Match(sdp, @"a=ice-pwd:(.+)");
        if (!pwdMatch.Success) throw new ArgumentException("No ice-pwd found in SDP");
        string pwd = pwdMatch.Groups[1].Value.Trim();

        // Filter host candidates and parse
        var hostCandidates = new List<(bool isIPv6, byte[] ipBytes, ushort port)>();
        foreach (string line in iceCandidateLines)
        {
            if (!line.Contains("typ host")) continue;
            var parsed = ParseCandidateLine(line);
            hostCandidates.Add(parsed);
        }

        // Calculate total size
        byte[] ufragBytes = Encoding.UTF8.GetBytes(ufrag);
        byte[] pwdBytes = Encoding.UTF8.GetBytes(pwd);
        int size = 1 + 32 + 1 + ufragBytes.Length + 1 + pwdBytes.Length + 1;
        foreach (var cand in hostCandidates)
        {
            size += 1 + (cand.isIPv6 ? 16 : 4) + 2;
        }

        byte[] result = new byte[size];
        int offset = 0;

        // Header byte
        byte header = (byte)((ProtocolVersion << 5) | (isOffer ? 0x00 : 0x10));
        result[offset++] = header;

        // Fingerprint (32 bytes)
        Array.Copy(fingerprintBytes, 0, result, offset, 32);
        offset += 32;

        // ufrag (length-prefixed)
        result[offset++] = (byte)ufragBytes.Length;
        Array.Copy(ufragBytes, 0, result, offset, ufragBytes.Length);
        offset += ufragBytes.Length;

        // pwd (length-prefixed)
        result[offset++] = (byte)pwdBytes.Length;
        Array.Copy(pwdBytes, 0, result, offset, pwdBytes.Length);
        offset += pwdBytes.Length;

        // Candidate count
        result[offset++] = (byte)hostCandidates.Count;

        // Candidates
        foreach (var cand in hostCandidates)
        {
            result[offset++] = (byte)(cand.isIPv6 ? 0x01 : 0x00);
            Array.Copy(cand.ipBytes, 0, result, offset, cand.ipBytes.Length);
            offset += cand.ipBytes.Length;
            BinaryPrimitives.WriteUInt16BigEndian(result.AsSpan(offset), cand.port);
            offset += 2;
        }

        return result;
    }

    /// <summary>
    /// Decode compact binary back to a full SDP string.
    /// </summary>
    public static (string sdp, bool isOffer) Decode(byte[] data)
    {
        if (data == null || data.Length < 1)
            throw new ArgumentException("Empty data");

        int offset = 0;

        // Header byte
        byte header = data[offset++];
        int version = (header >> 5) & 0x07;
        if (version != 0)
            throw new ArgumentException($"Unsupported protocol version: {version}");
        bool isOffer = (header & 0x10) == 0;

        // Fingerprint (32 bytes)
        byte[] fpBytes = new byte[32];
        Array.Copy(data, offset, fpBytes, 0, 32);
        offset += 32;
        string fingerprint = BytesToHexColon(fpBytes);

        // ufrag
        int ufragLen = data[offset++];
        string ufrag = Encoding.UTF8.GetString(data, offset, ufragLen);
        offset += ufragLen;

        // pwd
        int pwdLen = data[offset++];
        string pwd = Encoding.UTF8.GetString(data, offset, pwdLen);
        offset += pwdLen;

        // Candidates
        int candCount = data[offset++];
        var candidates = new List<(string ip, ushort port)>();
        for (int i = 0; i < candCount; i++)
        {
            byte flags = data[offset++];
            bool isIPv6 = (flags & 0x01) != 0;
            int ipLen = isIPv6 ? 16 : 4;
            byte[] ipBytes = new byte[ipLen];
            Array.Copy(data, offset, ipBytes, 0, ipLen);
            offset += ipLen;
            ushort port = BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(offset));
            offset += 2;
            string ip = new IPAddress(ipBytes).ToString();
            candidates.Add((ip, port));
        }

        // Build SDP
        string setup = isOffer ? "actpass" : "active";
        var sb = new StringBuilder();

        foreach (string line in SdpTemplateLines)
        {
            sb.Append(line).Append("\r\n");
        }

        sb.Append($"a=ice-ufrag:{ufrag}\r\n");
        sb.Append($"a=ice-pwd:{pwd}\r\n");
        sb.Append($"a=fingerprint:sha-256 {fingerprint}\r\n");
        sb.Append($"a=setup:{setup}\r\n");
        sb.Append("a=sctp-port:5000\r\n");
        sb.Append("a=max-message-size:262144\r\n");

        for (int i = 0; i < candidates.Count; i++)
        {
            var c = candidates[i];
            uint priority = (uint)((126 << 24) | ((65535 - i) << 8) | 255);
            int foundation = i + 1;
            sb.Append($"a=candidate:{foundation} 1 udp {priority} {c.ip} {c.port} typ host generation 0\r\n");
        }

        return (sb.ToString(), isOffer);
    }

    /// <summary>Encode binary data to base64.</summary>
    public static string ToBase64(byte[] data) => Convert.ToBase64String(data);

    /// <summary>Decode base64 string to binary data.</summary>
    public static byte[] FromBase64(string str) => Convert.FromBase64String(str);

    // ── Internal helpers ──

    private static byte[] HexColonToBytes(string hexColon)
    {
        string[] parts = hexColon.Split(':');
        byte[] bytes = new byte[parts.Length];
        for (int i = 0; i < parts.Length; i++)
        {
            bytes[i] = Convert.ToByte(parts[i], 16);
        }
        return bytes;
    }

    private static string BytesToHexColon(byte[] bytes)
    {
        // BitConverter.ToString produces "XX-XX-XX" format, convert to "XX:XX:XX"
        return BitConverter.ToString(bytes).Replace("-", ":");
    }

    private static (bool isIPv6, byte[] ipBytes, ushort port) ParseCandidateLine(string line)
    {
        // Format: "a=candidate:foundation 1 udp priority ip port typ host ..."
        // or: "candidate:foundation 1 udp priority ip port typ host ..."
        string[] parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);

        // Find the start - handle both "a=candidate:..." and "candidate:..."
        int baseIndex = 0;
        for (int i = 0; i < parts.Length; i++)
        {
            if (parts[i].StartsWith("candidate:", StringComparison.Ordinal) ||
                parts[i].StartsWith("a=candidate:", StringComparison.Ordinal))
            {
                baseIndex = i;
                break;
            }
        }

        string ipStr = parts[baseIndex + 4];
        ushort port = ushort.Parse(parts[baseIndex + 5]);
        bool isIPv6 = ipStr.Contains(":");
        byte[] ipBytes = IPAddress.Parse(ipStr).GetAddressBytes();

        return (isIPv6, ipBytes, port);
    }
}
