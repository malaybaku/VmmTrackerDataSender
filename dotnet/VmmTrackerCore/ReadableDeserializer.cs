using System;
using System.Text.Json;

namespace VmmTrackerCore;

/// <summary>
/// Deserializer for Readable format (JSON)
/// </summary>
public class ReadableDeserializer : ITrackingDataDeserializer
{
    private class ReadableFormat
    {
        public HeadPoseJson? headPose { get; set; }
        public JsonElement? blendShape { get; set; }
    }

    private class HeadPoseJson
    {
        public float px { get; set; }
        public float py { get; set; }
        public float pz { get; set; }
        public float rx { get; set; }
        public float ry { get; set; }
        public float rz { get; set; }
        public float rw { get; set; }
    }

    public TrackingData Deserialize(string data)
    {
        if (string.IsNullOrWhiteSpace(data))
        {
            throw new ArgumentException("Data cannot be null or empty");
        }

        var json = JsonSerializer.Deserialize<ReadableFormat>(data);
        if (json?.headPose == null)
        {
            throw new ArgumentException("Invalid JSON format: missing headPose");
        }

        var trackingData = new TrackingData
        {
            HeadPose = new HeadPose
            {
                PositionX = json.headPose.px,
                PositionY = json.headPose.py,
                PositionZ = json.headPose.pz,
                RotationX = json.headPose.rx,
                RotationY = json.headPose.ry,
                RotationZ = json.headPose.rz,
                RotationW = json.headPose.rw
            }
        };

        // Parse blend shapes
        if (json.blendShape.HasValue)
        {
            var blendShapeDict = JsonSerializer.Deserialize<System.Collections.Generic.Dictionary<string, int>>(json.blendShape.Value.GetRawText());
            if (blendShapeDict != null)
            {
                int index = 0;
                foreach (var value in blendShapeDict.Values)
                {
                    if (index >= 52) break;
                    trackingData.BlendShapes[index++] = (byte)Math.Clamp(value, 0, 255);
                }
            }
        }

        return trackingData;
    }

    public TrackingData Deserialize(byte[] data)
    {
        var text = System.Text.Encoding.UTF8.GetString(data);
        return Deserialize(text);
    }
}
