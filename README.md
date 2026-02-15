# VmmTrackerDataSender

Author: Baxter

Face (and maybe hand etc.) tracking client to run with VMagicMirror

## 🌐 Web Application

<!-- TODO: Update this URL after the first deployment -->
**Live Demo:** https://malaybaku.github.io/VmmTrackerDataSender/

## Overview

VmmTrackerDataSender is a web-based face tracking application that uses **MediaPipe** to capture facial movements and send tracking data to a desktop application (such as VMagicMirror) via **WebSocket**.

### Key Features

- **Browser-based face tracking** using MediaPipe Face Landmarker
- **Real-time data transmission** via WebSocket
- **Multiple data formats** supported:
  - Readable (JSON) format for debugging
  - Compressed (Binary) format for efficiency
- **Flexible video sources**:
  - Camera (smartphone/PC webcam)
  - Video file upload
- **Cross-platform**: Works on desktop and mobile browsers

### How It Works

1. Open the web application on your smartphone or PC
2. Select video source (camera or video file)
3. Connect to the WebSocket server (running on your desktop)
4. Start tracking - facial movements are captured and sent in real-time

### Technology Stack

- **Frontend**: TypeScript + Vite
- **Face Tracking**: MediaPipe Tasks Vision (@mediapipe/tasks-vision)
- **Communication**: WebSocket (ws://)
- **Deployment**: GitHub Pages

## Documentation

For detailed information, see:
- [Requirement.md](./Requirement.md) - Project requirements and specifications
- [docs/protocol.md](./docs/protocol.md) - WebSocket protocol specification
- [docs/web-implementation-plan.md](./docs/web-implementation-plan.md) - Web implementation details
