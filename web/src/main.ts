/**
 * VMM Tracker Data Sender - Web Application
 * Face tracking using MediaPipe and data transmission via WebSocket
 */

import { VideoSourceState, PreviewMode, TrackingStatus } from './types';
import type { HeadPose, EulerAngles, SerializationFormat } from './types';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { VideoSourceManager } from './videoSource';
import { MediaPipeManager } from './mediapipe';
import { WebSocketManager } from './websocket';
import { WebRTCManager } from './webrtc';
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

// Connection type
const connectionTypeSelect = document.getElementById('connection-type-select') as HTMLSelectElement;

// WebSocket elements
const websocketSettings = document.getElementById('websocket-settings') as HTMLDivElement;
const serverUrlInput = document.getElementById('server-url') as HTMLInputElement;
const formatSelect = document.getElementById('format-select') as HTMLSelectElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;

// WebRTC elements
const webrtcSettings = document.getElementById('webrtc-settings') as HTMLDivElement;
const webrtcFormatSelect = document.getElementById('webrtc-format-select') as HTMLSelectElement;
const webrtcInitOffererBtn = document.getElementById('webrtc-init-offerer-btn') as HTMLButtonElement;
const webrtcInitAnswererBtn = document.getElementById('webrtc-init-answerer-btn') as HTMLButtonElement;
const webrtcOfferSdp = document.getElementById('webrtc-offer-sdp') as HTMLTextAreaElement;
const webrtcAnswerSdp = document.getElementById('webrtc-answer-sdp') as HTMLTextAreaElement;
const webrtcIceCandidate = document.getElementById('webrtc-ice-candidate') as HTMLTextAreaElement;
const webrtcCopyOfferBtn = document.getElementById('webrtc-copy-offer-btn') as HTMLButtonElement;
const webrtcSetAnswerBtn = document.getElementById('webrtc-set-answer-btn') as HTMLButtonElement;
const webrtcAddIceBtn = document.getElementById('webrtc-add-ice-btn') as HTMLButtonElement;
const webrtcStatus = document.getElementById('webrtc-status') as HTMLSpanElement;

// Other elements
const previewModeSelect = document.getElementById('preview-mode-select') as HTMLSelectElement;
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
const webrtcManager = new WebRTCManager();
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
// State Management for Connection
// ============================================================================

type ConnectionType = 'websocket' | 'webrtc';
let currentConnectionType: ConnectionType = 'websocket';

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
  // Send data based on connection type
  if (currentConnectionType === 'websocket') {
    const format = formatSelect.value as SerializationFormat;
    websocketManager.sendTrackingData(data, format);
  } else if (currentConnectionType === 'webrtc') {
    const format = webrtcFormatSelect.value as SerializationFormat;
    webrtcManager.sendTrackingData(data, format);
  }

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

// WebRTC Events
webrtcManager.onConnectionStateChange = (state) => {
  console.log('[Main] WebRTC connection state:', state);
  webrtcStatus.textContent = `Connection: ${state}`;
  webrtcStatus.className = 'status';
  if (state === 'connected') {
    webrtcStatus.classList.add('connected');
  } else if (state === 'failed') {
    webrtcStatus.classList.add('error');
  }
};

webrtcManager.onDataChannelStateChange = (state) => {
  console.log('[Main] WebRTC data channel state:', state);
  if (state === 'open') {
    uiManager.updateStatus('WebRTC DataChannel opened', 'connected');
  } else if (state === 'closed') {
    uiManager.updateStatus('WebRTC DataChannel closed', 'normal');
  }
};

webrtcManager.onOfferGenerated = (sdp) => {
  console.log('[Main] Offer SDP generated');
  webrtcOfferSdp.value = sdp;
};

webrtcManager.onAnswerGenerated = (sdp) => {
  console.log('[Main] Answer SDP generated');
  webrtcAnswerSdp.value = sdp;
};

webrtcManager.onIceCandidate = (candidate) => {
  console.log('[Main] ICE candidate:', candidate.candidate);
  // Append ICE candidate to textarea (one per line)
  const candidateJson = JSON.stringify({
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex
  });
  if (webrtcIceCandidate.value) {
    webrtcIceCandidate.value += '\n' + candidateJson;
  } else {
    webrtcIceCandidate.value = candidateJson;
  }
};

webrtcManager.onError = (error) => {
  console.error('[Main] WebRTC error:', error);
  uiManager.updateStatus(`WebRTC error: ${error.message}`, 'error');
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

// Connection Type Change
connectionTypeSelect.addEventListener('change', () => {
  const type = connectionTypeSelect.value as ConnectionType;
  currentConnectionType = type;

  if (type === 'websocket') {
    websocketSettings.style.display = 'flex';
    webrtcSettings.style.display = 'none';
  } else {
    websocketSettings.style.display = 'none';
    webrtcSettings.style.display = 'block';
  }
});

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

// WebRTC: Initialize as Offerer
webrtcInitOffererBtn.addEventListener('click', async () => {
  try {
    uiManager.updateStatus('Initializing WebRTC as offerer...', 'normal');
    await webrtcManager.initializeAsOfferer();
    uiManager.updateStatus('Offer generated. Copy and send to remote peer.', 'normal');
  } catch (err) {
    console.error('[Main] Failed to initialize as offerer:', err);
    uiManager.updateStatus('Failed to initialize WebRTC', 'error');
  }
});

// WebRTC: Initialize as Answerer
webrtcInitAnswererBtn.addEventListener('click', async () => {
  const offerSdp = webrtcOfferSdp.value.trim();
  if (!offerSdp) {
    uiManager.updateStatus('Please paste Offer SDP first', 'error');
    return;
  }

  try {
    uiManager.updateStatus('Initializing WebRTC as answerer...', 'normal');
    await webrtcManager.initializeAsAnswerer(offerSdp);
    uiManager.updateStatus('Answer generated. Copy and send to remote peer.', 'normal');
  } catch (err) {
    console.error('[Main] Failed to initialize as answerer:', err);
    uiManager.updateStatus('Failed to initialize WebRTC', 'error');
  }
});

// WebRTC: Copy Offer SDP
webrtcCopyOfferBtn.addEventListener('click', async () => {
  const sdp = webrtcOfferSdp.value;
  if (!sdp) {
    uiManager.updateStatus('No Offer SDP to copy', 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(sdp);
    uiManager.updateStatus('Offer SDP copied to clipboard', 'normal');
  } catch (err) {
    console.error('[Main] Failed to copy:', err);
    uiManager.updateStatus('Failed to copy to clipboard', 'error');
  }
});

// WebRTC: Set Answer SDP
webrtcSetAnswerBtn.addEventListener('click', async () => {
  const answerSdp = webrtcAnswerSdp.value.trim();
  if (!answerSdp) {
    uiManager.updateStatus('Please paste Answer SDP first', 'error');
    return;
  }

  try {
    uiManager.updateStatus('Setting Answer SDP...', 'normal');
    await webrtcManager.setRemoteAnswer(answerSdp);
    uiManager.updateStatus('Answer SDP set. Connection establishing...', 'normal');
  } catch (err) {
    console.error('[Main] Failed to set answer:', err);
    uiManager.updateStatus('Failed to set Answer SDP', 'error');
  }
});

// WebRTC: Add ICE Candidate
webrtcAddIceBtn.addEventListener('click', async () => {
  const candidateText = webrtcIceCandidate.value.trim();
  if (!candidateText) {
    uiManager.updateStatus('Please paste ICE candidate JSON', 'error');
    return;
  }

  try {
    // Parse JSON (assume one candidate per line)
    const lines = candidateText.split('\n').filter(line => line.trim());
    for (const line of lines) {
      const candidate = JSON.parse(line);
      await webrtcManager.addIceCandidate(candidate);
    }
    uiManager.updateStatus(`Added ${lines.length} ICE candidate(s)`, 'normal');
    webrtcIceCandidate.value = ''; // Clear after adding
  } catch (err) {
    console.error('[Main] Failed to add ICE candidate:', err);
    uiManager.updateStatus('Failed to add ICE candidate. Check JSON format.', 'error');
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
