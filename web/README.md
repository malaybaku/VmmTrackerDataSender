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
├── test-data/            # Debug video files (gitignored)
│   ├── .gitkeep          # Directory placeholder
│   └── debug-video.mp4   # Auto-loaded in dev mode (not in repo)
├── index.html            # HTML template
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── README.md
```

## Debug Mode Setup (Development Only)

For faster development iteration, the application supports **auto-start mode** in development environment (`npm run dev`).

### How to Enable

1. Place a video file at `web/test-data/debug-video.mp4`
2. Start development server: `npm run dev`
3. The application will automatically:
   - Load the debug video
   - Connect to `ws://localhost:9090`
   - Start tracking

### How to Disable

- Simply remove `web/test-data/debug-video.mp4`
- Or use production build (`npm run build`)

### Notes

- Debug mode **only works in development** (`npm run dev`)
- Production builds (GitHub Pages) are **not affected**
- The debug video file is **gitignored** (not tracked in repository)
- You can use any video file with a face (mp4, webm, mov, avi)

### Example Setup

```bash
# Copy your test video
cp /path/to/your/face-video.mp4 web/test-data/debug-video.mp4

# Start dev server with auto-start
npm run dev

# The app will automatically start tracking!
```
