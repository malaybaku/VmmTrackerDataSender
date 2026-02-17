using VmmTrackerCore;

namespace VmmTrackerDataSender.Tests;

/// <summary>
/// Tests for SdpCodec using shared test vectors that match the TypeScript tests
/// for interoperability verification.
/// </summary>
public class SdpCodecTests
{
    // ── Shared constants ──

    private const string TestFingerprintHex =
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:" +
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";

    private static string BuildTestSdp(string fingerprint, string ufrag, string pwd) =>
        "v=0\r\n" +
        "o=- 123456 2 IN IP4 127.0.0.1\r\n" +
        "s=-\r\n" +
        "t=0 0\r\n" +
        "a=group:BUNDLE 0\r\n" +
        "m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n" +
        "c=IN IP4 0.0.0.0\r\n" +
        "a=mid:0\r\n" +
        $"a=ice-ufrag:{ufrag}\r\n" +
        $"a=ice-pwd:{pwd}\r\n" +
        $"a=fingerprint:sha-256 {fingerprint}\r\n" +
        "a=setup:actpass\r\n" +
        "a=sctp-port:5000\r\n" +
        "a=max-message-size:262144\r\n" +
        "\r\n";

    private static string MakeCandidateLine(string ip, int port) =>
        $"a=candidate:1 1 udp 2113937151 {ip} {port} typ host generation 0";

    // ── Test Vector 1: IPv4 offer, 1 candidate, 71 bytes ──

    private static readonly string Tv1Sdp = BuildTestSdp(TestFingerprintHex, "abcd", "aabbccddee112233aabbccdd");
    private static readonly string[] Tv1Candidates = new[] { MakeCandidateLine("192.168.1.100", 12345) };
    private static readonly byte[] Tv1ExpectedBytes = new byte[]
    {
        // header: offer, version 0
        0x00,
        // fingerprint (32 bytes)
        0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
        0x66, 0x77, 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11,
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
        0x00, 0xC0, 0xA8, 0x01, 0x64, 0x30, 0x39,
    };

    // ── Test Vector 2: IPv4 answer, 2 candidates, 78 bytes ──

    private static readonly string Tv2Sdp = BuildTestSdp(TestFingerprintHex, "abcd", "aabbccddee112233aabbccdd");
    private static readonly string[] Tv2Candidates = new[]
    {
        MakeCandidateLine("192.168.1.100", 12345),
        MakeCandidateLine("10.0.0.1", 54321),
    };
    private static readonly byte[] Tv2ExpectedBytes = new byte[]
    {
        // header: answer
        0x10,
        // fingerprint (32 bytes)
        0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
        0x66, 0x77, 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11,
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
        0x00, 0xC0, 0xA8, 0x01, 0x64, 0x30, 0x39,
        // candidate 2: IPv4, 10.0.0.1:54321 (0xD431)
        0x00, 0x0A, 0x00, 0x00, 0x01, 0xD4, 0x31,
    };

    // ── Test Vector 3: IPv6 candidate, 83 bytes ──

    private static readonly string Tv3Sdp = BuildTestSdp(TestFingerprintHex, "abcd", "aabbccddee112233aabbccdd");
    private static readonly string[] Tv3Candidates = new[] { MakeCandidateLine("fe80::1", 9999) };
    private static readonly byte[] Tv3ExpectedBytes = new byte[]
    {
        // header: offer
        0x00,
        // fingerprint (32 bytes)
        0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
        0x66, 0x77, 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11,
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
        0x01, 0xFE, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x27, 0x0F,
    };

    // ── Encode tests ──

    [Fact]
    public void Encode_Tv1_IPv4Offer_MatchesExpectedBinary()
    {
        var result = SdpCodec.Encode(Tv1Sdp, isOffer: true, Tv1Candidates);
        Assert.Equal(Tv1ExpectedBytes, result);
        Assert.Equal(71, result.Length);
    }

    [Fact]
    public void Encode_Tv2_IPv4Answer_MatchesExpectedBinary()
    {
        var result = SdpCodec.Encode(Tv2Sdp, isOffer: false, Tv2Candidates);
        Assert.Equal(Tv2ExpectedBytes, result);
        Assert.Equal(78, result.Length);
    }

    [Fact]
    public void Encode_Tv3_IPv6Offer_MatchesExpectedBinary()
    {
        var result = SdpCodec.Encode(Tv3Sdp, isOffer: true, Tv3Candidates);
        Assert.Equal(Tv3ExpectedBytes, result);
        Assert.Equal(83, result.Length);
    }

    [Fact]
    public void Encode_FiltersNonHostCandidates()
    {
        var candidates = new[]
        {
            MakeCandidateLine("192.168.1.100", 12345),
            "a=candidate:2 1 udp 1677729535 203.0.113.1 54321 typ srflx raddr 192.168.1.100 rport 12345 generation 0",
        };
        var result = SdpCodec.Encode(Tv1Sdp, isOffer: true, candidates);
        Assert.Equal(Tv1ExpectedBytes, result);
    }

    // ── Decode tests ──

    [Fact]
    public void Decode_Tv1_ProducesValidSdp()
    {
        var (sdp, isOffer) = SdpCodec.Decode(Tv1ExpectedBytes);
        Assert.True(isOffer);
        Assert.Contains("a=ice-ufrag:abcd\r\n", sdp);
        Assert.Contains("a=ice-pwd:aabbccddee112233aabbccdd\r\n", sdp);
        Assert.Contains($"a=fingerprint:sha-256 {TestFingerprintHex}\r\n", sdp);
        Assert.Contains("a=setup:actpass\r\n", sdp);
        Assert.Contains("a=sctp-port:5000\r\n", sdp);
        Assert.Contains("a=max-message-size:262144\r\n", sdp);
        Assert.Contains("a=group:BUNDLE 0\r\n", sdp);
        Assert.Contains("192.168.1.100 12345 typ host", sdp);
    }

    [Fact]
    public void Decode_Tv2_AnswerWithSetupActive()
    {
        var (sdp, isOffer) = SdpCodec.Decode(Tv2ExpectedBytes);
        Assert.False(isOffer);
        Assert.Contains("a=setup:active\r\n", sdp);
        Assert.Contains("192.168.1.100 12345 typ host", sdp);
        Assert.Contains("10.0.0.1 54321 typ host", sdp);
    }

    [Fact]
    public void Decode_Tv3_IPv6Candidate()
    {
        var (sdp, isOffer) = SdpCodec.Decode(Tv3ExpectedBytes);
        Assert.True(isOffer);
        // .NET IPAddress.ToString() for fe80::1 may produce "fe80::1"
        Assert.Contains("9999 typ host", sdp);
        Assert.Contains("fe80::1", sdp);
    }

    [Fact]
    public void Decode_UsesCorrectLineEndings()
    {
        var (sdp, _) = SdpCodec.Decode(Tv1ExpectedBytes);
        // Should not contain bare \n (all should be \r\n)
        var withoutCrLf = sdp.Replace("\r\n", "");
        Assert.DoesNotContain("\n", withoutCrLf);
        Assert.EndsWith("\r\n", sdp);
    }

    [Fact]
    public void Decode_ThrowsOnUnsupportedVersion()
    {
        var badData = (byte[])Tv1ExpectedBytes.Clone();
        badData[0] = 0xE0; // version 7
        Assert.Throws<ArgumentException>(() => SdpCodec.Decode(badData));
    }

    [Fact]
    public void Decode_ThrowsOnEmptyData()
    {
        Assert.Throws<ArgumentException>(() => SdpCodec.Decode(Array.Empty<byte>()));
    }

    [Fact]
    public void Decode_ProducesCorrectCandidatePriorityAndFoundation()
    {
        var (sdp, _) = SdpCodec.Decode(Tv2ExpectedBytes);
        // candidate 1: foundation=1, priority = (126<<24)|((65535-0)<<8)|255 = 2130706431
        Assert.Contains("a=candidate:1 1 udp 2130706431 192.168.1.100 12345 typ host generation 0", sdp);
        // candidate 2: foundation=2, priority = (126<<24)|((65535-1)<<8)|255 = 2130706175
        Assert.Contains("a=candidate:2 1 udp 2130706175 10.0.0.1 54321 typ host generation 0", sdp);
    }

    // ── Roundtrip tests ──

    [Fact]
    public void Roundtrip_Tv1_Offer()
    {
        var encoded = SdpCodec.Encode(Tv1Sdp, isOffer: true, Tv1Candidates);
        var (sdp, isOffer) = SdpCodec.Decode(encoded);
        Assert.True(isOffer);
        Assert.Contains($"a=fingerprint:sha-256 {TestFingerprintHex}", sdp);
        Assert.Contains("a=ice-ufrag:abcd", sdp);
        Assert.Contains("a=ice-pwd:aabbccddee112233aabbccdd", sdp);
        Assert.Contains("192.168.1.100 12345 typ host", sdp);
    }

    [Fact]
    public void Roundtrip_Tv2_Answer()
    {
        var encoded = SdpCodec.Encode(Tv2Sdp, isOffer: false, Tv2Candidates);
        var (sdp, isOffer) = SdpCodec.Decode(encoded);
        Assert.False(isOffer);
        Assert.Contains("a=setup:active", sdp);
    }

    [Fact]
    public void Roundtrip_Tv3_IPv6()
    {
        var encoded = SdpCodec.Encode(Tv3Sdp, isOffer: true, Tv3Candidates);
        var (sdp, isOffer) = SdpCodec.Decode(encoded);
        Assert.True(isOffer);
        Assert.Contains("9999 typ host", sdp);
    }

    // ── Base64 tests ──

    [Fact]
    public void Base64_Roundtrip_Tv1()
    {
        var b64 = SdpCodec.ToBase64(Tv1ExpectedBytes);
        var decoded = SdpCodec.FromBase64(b64);
        Assert.Equal(Tv1ExpectedBytes, decoded);
    }

    [Fact]
    public void Base64_Roundtrip_Tv2()
    {
        var b64 = SdpCodec.ToBase64(Tv2ExpectedBytes);
        var decoded = SdpCodec.FromBase64(b64);
        Assert.Equal(Tv2ExpectedBytes, decoded);
    }

    [Fact]
    public void Base64_ProducesValidString()
    {
        var b64 = SdpCodec.ToBase64(Tv1ExpectedBytes);
        Assert.Matches(@"^[A-Za-z0-9+/]+=*$", b64);
    }
}
