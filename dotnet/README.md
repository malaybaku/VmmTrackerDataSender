# VMM Tracker Data Receiver - .NET Application

WebSocket server application for receiving face tracking data.

## Tech Stack

- **.NET 8**: Console application (reference implementation)
- **.NET Standard 2.1**: Core library (Unity/WPF compatible)
- **System.Net.WebSockets**: WebSocket server
- **System.Text.Json**: JSON deserialization

## Project Structure

```
dotnet/
├── VmmTrackerReceiver/       # Console application (.NET 8)
│   └── Program.cs
├── VmmTrackerCore/           # Core library (.NET Standard 2.1)
│   ├── TrackingData.cs       # Data models
│   ├── ITrackingDataDeserializer.cs
│   ├── CompressedDeserializer.cs
│   ├── ReadableDeserializer.cs
│   └── WebSocketServer.cs
├── VmmTrackerDataSender.sln
└── README.md
```

## Build

```bash
dotnet build
```

## Run

### Compressed format (default, binary)

```bash
dotnet run --project VmmTrackerReceiver
```

Or with explicit options:

```bash
dotnet run --project VmmTrackerReceiver -- --port 8080 --format compressed
```

### Readable format (JSON)

```bash
dotnet run --project VmmTrackerReceiver -- --port 8080 --format readable
```

## Command Line Options

- `--port <number>`: WebSocket server port (default: 8080)
- `--format <compressed|readable>`: Data format (default: compressed)

## Usage

1. Start the receiver application
2. Note the WebSocket URL (e.g., `ws://192.168.1.100:8080`)
3. Open the web application and enter this URL
4. Start tracking on the web application
5. Tracking data will be displayed in the console

## Integration with Unity/WPF

The `VmmTrackerCore` library is .NET Standard 2.1 compatible and can be referenced from:

- **Unity 6.0** (or Unity 2021.2+)
- **WPF (.NET Framework 4.7.2+)**
- **WPF (.NET 6/7/8)**

### Example Integration

```csharp
using VmmTrackerCore;

// Create deserializer
var deserializer = new CompressedDeserializer();

// Create WebSocket server
var server = new WebSocketServer(8080, deserializer);

server.DataReceived += (data) =>
{
    // Use tracking data in your application
    Debug.Log($"Head position: {data.HeadPose.PositionX}, {data.HeadPose.PositionY}, {data.HeadPose.PositionZ}");

    // Apply blend shapes
    for (int i = 0; i < data.BlendShapes.Length; i++)
    {
        float normalizedValue = data.BlendShapes[i] / 255.0f;
        // Apply to your VRM model
    }
};

server.Start();
```

## Data Formats

### Compressed Format (Binary)

80 bytes total:
- Position: 12 bytes (3 x float32)
- Rotation: 16 bytes (4 x float32, Quaternion)
- BlendShapes: 52 bytes (52 x uint8)

### Readable Format (JSON)

```json
{
  "headPose": {
    "px": 0.0, "py": 0.0, "pz": 0.0,
    "rx": 0.0, "ry": 0.0, "rz": 0.0, "rw": 1.0
  },
  "blendShape": {
    "eyeBlinkLeft": 128,
    "eyeBlinkRight": 128,
    ...
  }
}
```

## TODO

- [ ] Add unit tests
- [ ] Add XML documentation comments
- [ ] Add logging framework integration
- [ ] Add configuration file support
- [ ] Consider adding HTTPS/WSS support for production use
