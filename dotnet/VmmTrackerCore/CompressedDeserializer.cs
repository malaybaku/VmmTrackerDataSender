using System;

namespace VmmTrackerCore;

/// <summary>
/// Deserializer for Compressed format (binary)
/// Data layout: [Version: 4 bytes] [Position: 12 bytes (float32 x 3)] [Rotation: 16 bytes (float32 x 4)] [BlendShapes: 52 bytes (uint8 x 52)]
/// Total: 84 bytes
/// </summary>
public class CompressedDeserializer : ITrackingDataDeserializer
{
    private const int ExpectedDataSize = 84;
    private const int VersionSize = 4;
    private const int PositionSize = 12;
    private const int RotationSize = 16;
    private const int BlendShapeCount = 52;
    private const int MaxSupportedMajorVersion = 1;

    public TrackingData Deserialize(byte[] data)
    {
        if (data == null)
        {
            throw new ArgumentNullException(nameof(data));
        }

        if (data.Length < ExpectedDataSize)
        {
            throw new ArgumentException($"Invalid data size. Expected at least {ExpectedDataSize} bytes, got {data.Length}");
        }

        int offset = 0;

        // Read version (4 bytes)
        byte majorVersion = data[offset];
        byte minorVersion = data[offset + 1];
        byte patchVersion = data[offset + 2];
        // byte reserved = data[offset + 3];

        // Validate major version
        if (majorVersion > MaxSupportedMajorVersion)
        {
            throw new ArgumentException($"Unsupported protocol version {majorVersion}.{minorVersion}.{patchVersion}. Maximum supported major version is {MaxSupportedMajorVersion}");
        }

        offset += VersionSize;

        var trackingData = new TrackingData();

        // Read position (3 floats)
        trackingData.HeadPose = new HeadPose
        {
            PositionX = BitConverter.ToSingle(data, offset),
            PositionY = BitConverter.ToSingle(data, offset + 4),
            PositionZ = BitConverter.ToSingle(data, offset + 8)
        };
        offset += PositionSize;

        // Read rotation (4 floats, quaternion)
        var pose = trackingData.HeadPose;
        pose.RotationX = BitConverter.ToSingle(data, offset);
        pose.RotationY = BitConverter.ToSingle(data, offset + 4);
        pose.RotationZ = BitConverter.ToSingle(data, offset + 8);
        pose.RotationW = BitConverter.ToSingle(data, offset + 12);
        trackingData.HeadPose = pose;
        offset += RotationSize;

        // Read blend shapes (52 bytes)
        Array.Copy(data, offset, trackingData.BlendShapes, 0, BlendShapeCount);

        return trackingData;
    }

    public TrackingData Deserialize(string data)
    {
        throw new NotSupportedException("CompressedDeserializer only supports binary data");
    }
}
