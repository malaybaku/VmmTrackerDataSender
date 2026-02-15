using System;

namespace VmmTrackerCore;

/// <summary>
/// Deserializer for Compressed format (binary)
/// Data layout: [Position: 12 bytes (float32 x 3)] [Rotation: 16 bytes (float32 x 4)] [BlendShapes: 52 bytes (uint8 x 52)]
/// Total: 80 bytes
/// </summary>
public class CompressedDeserializer : ITrackingDataDeserializer
{
    private const int ExpectedDataSize = 80;
    private const int PositionSize = 12;
    private const int RotationSize = 16;
    private const int BlendShapeCount = 52;

    public TrackingData Deserialize(byte[] data)
    {
        if (data == null || data.Length != ExpectedDataSize)
        {
            throw new ArgumentException($"Invalid data size. Expected {ExpectedDataSize} bytes, got {data?.Length ?? 0}");
        }

        var trackingData = new TrackingData();
        int offset = 0;

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
