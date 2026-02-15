namespace VmmTrackerCore;

/// <summary>
/// Head pose data (position and rotation)
/// </summary>
public struct HeadPose
{
    public float PositionX { get; set; }
    public float PositionY { get; set; }
    public float PositionZ { get; set; }

    public float RotationX { get; set; }
    public float RotationY { get; set; }
    public float RotationZ { get; set; }
    public float RotationW { get; set; }

    public override string ToString()
    {
        return $"Pos({PositionX:F3}, {PositionY:F3}, {PositionZ:F3}) " +
               $"Rot({RotationX:F3}, {RotationY:F3}, {RotationZ:F3}, {RotationW:F3})";
    }
}

/// <summary>
/// Face tracking data including head pose and blend shapes
/// </summary>
public class TrackingData
{
    public HeadPose HeadPose { get; set; }
    public byte[] BlendShapes { get; set; } = new byte[52];

    public override string ToString()
    {
        return $"HeadPose: {HeadPose}\n" +
               $"BlendShapes: {BlendShapes.Length} values (first 3: {BlendShapes[0]}, {BlendShapes[1]}, {BlendShapes[2]})";
    }
}
