# VMM Tracker Data Sender - Web Application

Face tracking web application using MediaPipe, transmitting data via WebSocket.

## Tech Stack

- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and dev server
- **MediaPipe Tasks Vision**: Face tracking with BlendShapes
- **WebSocket API**: Real-time data transmission

## Development

### Prerequisites

- Node.js 18+ and npm

### Setup

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Open http://localhost:3000

### Build for Production

```bash
npm run build
```

Build output will be in `dist/` folder.

### Type Checking

```bash
npm run type-check
```

## Usage

1. Start the .NET WebSocket server (see `../dotnet/README.md`)
2. Open the web application
3. Click "Start Camera" to enable webcam
4. Enter WebSocket server URL (e.g., `ws://192.168.1.100:8080`)
5. Select data format (Readable or Compressed)
6. Click "Connect" to establish WebSocket connection
7. Click "Start Tracking" to begin face tracking and data transmission

## Project Structure

```
web/
├── src/
│   ├── main.ts           # Application entry point
│   └── vite-env.d.ts     # Vite type definitions
├── index.html            # HTML template
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── README.md
```

## TODO

- [ ] Implement MediaPipe Face Landmarker initialization
- [ ] Implement video frame processing
- [ ] Implement head pose calculation
- [ ] Implement BlendShape data extraction
- [ ] Implement Readable format serialization (JSON)
- [ ] Implement Compressed format serialization (Binary)
- [ ] Implement WebSocket data transmission
- [ ] Add error handling and reconnection logic
- [ ] Add performance monitoring (FPS counter)
