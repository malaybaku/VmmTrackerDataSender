/**
 * VMM Tracker Data Sender - Web Application
 * Face tracking using MediaPipe and data transmission via WebSocket
 */

import { VideoSourceState, PreviewMode, TrackingStatus } from './types';
import type { HeadPose, EulerAngles } from './types';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { VideoSourceManager } from './videoSource';
import { MediaPipeManager } from './mediapipe';
import { WebSocketManager } from './websocket';
import { UIManager } from './ui';
import { PreviewRenderer } from './previewRenderer';
import { quaternionToEuler } from './utils/math';
import { autoStartDebugMode } from './debug';

// ============================================================================
// UI Elements
// ============================================================================

const video = document.getElementById('video') as HTMLVideoElement;
const previewCanvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
const previewOverlay = document.getElementById('preview-overlay') as HTMLDivElement;
const serverUrlInput = document.getElementById('server-url') as HTMLInputElement;
const formatSelect = document.getElementById('format-select') as HTMLSelectElement;
const previewModeSelect = document.getElementById('preview-mode-select') as HTMLSelectElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const startCameraBtn = document.getElementById('start-camera-btn') as HTMLButtonElement;
const startVideoBtn = document.getElementById('start-video-btn') as HTMLButtonElement;
const restartVideoBtn = document.getElementById('restart-video-btn') as HTMLButtonElement;
const stopTrackingBtn = document.getElementById('stop-tracking-btn') as HTMLButtonElement;
const videoFileInput = document.getElementById('video-file-input') as HTMLInputElement;
const statusSpan = document.getElementById('status') as HTMLSpanElement;

// ============================================================================
// Manager Instances
// ============================================================================

const videoSourceManager = new VideoSourceManager(video);
const mediapipeManager = new MediaPipeManager();
const websocketManager = new WebSocketManager();
const uiManager = new UIManager(
  statusSpan,
  connectBtn,
  startCameraBtn,
  startVideoBtn,
  restartVideoBtn,
  stopTrackingBtn
);
const previewRenderer = new PreviewRenderer(previewCanvas, previewOverlay, video);

// ============================================================================
// State Management for Preview
// ============================================================================

let currentTrackingStatus: TrackingStatus = TrackingStatus.NotTracking;
let currentHeadPose: HeadPose | null = null;
let currentEuler: EulerAngles | null = null;
let currentLandmarks: NormalizedLandmark[] | null = null;

// ============================================================================
// Event Handlers Setup
// ============================================================================

// Video Source State Changes
videoSourceManager.onStateChange = (newState) => {
  uiManager.updateButtonStates(newState);
};

// MediaPipe Events
mediapipeManager.onInitialized = () => {
  uiManager.updateStatus('MediaPipe loaded successfully', 'normal');
};

mediapipeManager.onError = (error) => {
  console.error('[Main] MediaPipe error:', error);
  uiManager.updateStatus('Failed to load MediaPipe', 'error');
};

mediapipeManager.onTrackingData = (data) => {
  const format = formatSelect.value as 'readable' | 'compressed';
  websocketManager.sendTrackingData(data, format);

  // Update state for preview
  currentHeadPose = data.headPose;
  currentEuler = quaternionToEuler({
    x: data.headPose.rx,
    y: data.headPose.ry,
    z: data.headPose.rz,
    w: data.headPose.rw
  });
};

mediapipeManager.onTrackingStatus = (status) => {
  currentTrackingStatus = status;
  updatePreview();
};

mediapipeManager.onLandmarks = (landmarks) => {
  currentLandmarks = landmarks;
};

// WebSocket Events
websocketManager.onOpen = () => {
  console.log('[Main] WebSocket connected');
  uiManager.updateStatus('Connected to server', 'connected');
  uiManager.setConnectButtonText('Disconnect');
};

websocketManager.onClose = () => {
  console.log('[Main] WebSocket closed');
  uiManager.updateStatus('Disconnected from server', 'normal');
  uiManager.setConnectButtonText('Connect');
};

websocketManager.onError = (err) => {
  console.error('[Main] WebSocket error:', err);
  uiManager.updateStatus('WebSocket connection error', 'error');
};

// ============================================================================
// Preview Update Function
// ============================================================================

function updatePreview(): void {
  previewRenderer.render(
    currentTrackingStatus,
    currentHeadPose,
    currentEuler,
    currentLandmarks
  );
}

// Start animation loop for mode C (landmarks rendering)
function startPreviewAnimationLoop(): void {
  function animate(): void {
    const mode = previewRenderer.getMode();
    if (mode === PreviewMode.StatusDataLandmarks) {
      updatePreview();
    }
    requestAnimationFrame(animate);
  }
  animate();
}

// Start animation loop
startPreviewAnimationLoop();

// ============================================================================
// Button Click Handlers
// ============================================================================

// Preview Mode Change
previewModeSelect.addEventListener('change', () => {
  const mode = previewModeSelect.value as PreviewMode;
  previewRenderer.setMode(mode);
  updatePreview();
});

// Connect to WebSocket
connectBtn.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim();
  console.log('[Main] Connect button clicked, URL:', url);

  if (!url) {
    uiManager.updateStatus('Please enter WebSocket URL', 'error');
    return;
  }

  // Disconnect if already connected
  if (websocketManager.isConnected()) {
    console.log('[Main] Disconnecting existing connection');
    websocketManager.disconnect();
    return;
  }

  try {
    console.log('[Main] Creating WebSocket connection to:', url);
    await websocketManager.connect(url);
  } catch (err) {
    console.error('[Main] Failed to connect:', err);
    uiManager.updateStatus('Failed to connect', 'error');
  }
});

// Start Camera
startCameraBtn.addEventListener('click', async () => {
  // Set busy state to prevent double-click
  uiManager.updateButtonStates(VideoSourceState.Busy);

  try {
    uiManager.updateStatus('Starting camera...', 'normal');
    await videoSourceManager.startCamera();

    uiManager.updateStatus('Starting tracking...', 'normal');
    await mediapipeManager.startTracking(video);

    uiManager.updateStatus('Camera tracking started', 'connected');
    console.log('[Main] Camera tracking successfully started');
  } catch (err) {
    console.error('[Main] Failed to start camera tracking:', err);
    uiManager.updateStatus(
      `Failed to start camera: ${err instanceof Error ? err.message : String(err)}`,
      'error'
    );
    videoSourceManager.stop();
  }
  // Note: Button states are updated via videoSourceManager.onStateChange
});

// Start Video File
startVideoBtn.addEventListener('click', () => {
  videoFileInput.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Set busy state to prevent double-click
    uiManager.updateButtonStates(VideoSourceState.Busy);

    try {
      uiManager.updateStatus('Loading video file...', 'normal');
      await videoSourceManager.startVideoFile(file);

      uiManager.updateStatus('Starting tracking...', 'normal');
      await mediapipeManager.startTracking(video);

      uiManager.updateStatus('Video tracking started', 'connected');
      console.log('[Main] Video tracking successfully started');
    } catch (err) {
      console.error('[Main] Failed to start video tracking:', err);
      uiManager.updateStatus(
        `Failed to start video: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
      videoSourceManager.stop();
      videoSourceManager.clearVideoReferences();
    }
    // Note: Button states are updated via videoSourceManager.onStateChange
  };
  videoFileInput.click();
});

// Restart Video
restartVideoBtn.addEventListener('click', async () => {
  // Set busy state to prevent double-click
  uiManager.updateButtonStates(VideoSourceState.Busy);

  try {
    uiManager.updateStatus('Restarting video...', 'normal');
    await videoSourceManager.restartVideo();

    uiManager.updateStatus('Starting tracking...', 'normal');
    await mediapipeManager.startTracking(video);

    uiManager.updateStatus('Video tracking restarted', 'connected');
    console.log('[Main] Video tracking successfully restarted');
  } catch (err) {
    console.error('[Main] Failed to restart video tracking:', err);
    uiManager.updateStatus(
      `Failed to restart video: ${err instanceof Error ? err.message : String(err)}`,
      'error'
    );
    // Restore VideoStopped state on error
    uiManager.updateButtonStates(VideoSourceState.VideoStopped);
  }
  // Note: On success, button states are updated via videoSourceManager.onStateChange
});

// Stop Tracking
stopTrackingBtn.addEventListener('click', () => {
  // Set busy state to prevent double-click
  uiManager.updateButtonStates(VideoSourceState.Busy);

  try {
    mediapipeManager.stopTracking();

    const state = videoSourceManager.getState();
    if (state === VideoSourceState.CameraRunning) {
      // Stop camera completely
      videoSourceManager.stop();
      uiManager.updateStatus('Camera stopped', 'normal');
    } else if (state === VideoSourceState.VideoRunning) {
      // Pause video
      videoSourceManager.pause();
      uiManager.updateStatus('Video paused', 'normal');
    }
  } catch (err) {
    console.error('[Main] Failed to stop tracking:', err);
    uiManager.updateStatus('Failed to stop tracking', 'error');
  }
  // Note: Button states are updated via videoSourceManager.onStateChange
});

// ============================================================================
// Initialization
// ============================================================================

uiManager.updateButtonStates(VideoSourceState.None);
uiManager.updateStatus('Ready - Click "Start Camera" or "Start Video"', 'normal');

// Initial preview render
updatePreview();

// Auto-start debug mode if in development
autoStartDebugMode(
  videoSourceManager,
  websocketManager,
  uiManager,
  serverUrlInput.value.trim()
);
