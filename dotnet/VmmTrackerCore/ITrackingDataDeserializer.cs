namespace VmmTrackerCore;

/// <summary>
/// Interface for tracking data deserialization
/// </summary>
public interface ITrackingDataDeserializer
{
    /// <summary>
    /// Deserialize binary data to TrackingData
    /// </summary>
    TrackingData Deserialize(byte[] data);

    /// <summary>
    /// Deserialize text data to TrackingData
    /// </summary>
    TrackingData Deserialize(string data);
}
