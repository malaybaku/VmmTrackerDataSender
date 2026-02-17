/**
 * VMM Tracker Data Sender - Web Application
 * Face tracking using MediaPipe and data transmission via WebSocket
 */

import { VideoSourceState, PreviewMode, TrackingStatus } from './types';
import type { HeadPose, EulerAngles, SerializationFormat } from './types';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { VideoSourceManager } from './videoSource';
import { MediaPipeManager } from './mediapipe';
import { WebRTCManager } from './webrtc';
import { UIManager } from './ui';
import { PreviewRenderer } from './previewRenderer';
import { quaternionToEuler } from './utils/math';

// ============================================================================
// UI Elements
// ============================================================================

const video = document.getElementById('video') as HTMLVideoElement;
const previewCanvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
const previewOverlay = document.getElementById('preview-overlay') as HTMLDivElement;

// WebRTC elements
const webrtcFormatSelect = document.getElementById('webrtc-format-select') as HTMLSelectElement;
const webrtcInitOffererBtn = document.getElementById('webrtc-init-offerer-btn') as HTMLButtonElement;
const webrtcInitAnswererBtn = document.getElementById('webrtc-init-answerer-btn') as HTMLButtonElement;
const webrtcOfferSdp = document.getElementById('webrtc-offer-sdp') as HTMLTextAreaElement;
const webrtcAnswerSdp = document.getElementById('webrtc-answer-sdp') as HTMLTextAreaElement;
const webrtcCopyOfferBtn = document.getElementById('webrtc-copy-offer-btn') as HTMLButtonElement;
const webrtcSetAnswerBtn = document.getElementById('webrtc-set-answer-btn') as HTMLButtonElement;
const webrtcStatus = document.getElementById('webrtc-status') as HTMLSpanElement;

// Other elements
const previewModeSelect = document.getElementById('preview-mode-select') as HTMLSelectElement;
const startCameraBtn = document.getElementById('start-camera-btn') as HTMLButtonElement;
const startVideoBtn = document.getElementById('start-video-btn') as HTMLButtonElement;
const stopTrackingBtn = document.getElementById('stop-tracking-btn') as HTMLButtonElement;
const videoFileInput = document.getElementById('video-file-input') as HTMLInputElement;
const statusSpan = document.getElementById('status') as HTMLSpanElement;

// ============================================================================
// Manager Instances
// ============================================================================

const videoSourceManager = new VideoSourceManager(video);
const mediapipeManager = new MediaPipeManager();
const webrtcManager = new WebRTCManager();
const uiManager = new UIManager(
  statusSpan,
  startCameraBtn,
  startVideoBtn,
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
  // Send data via WebRTC DataChannel
  const format = webrtcFormatSelect.value as SerializationFormat;
  webrtcManager.sendTrackingData(data, format);

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

webrtcManager.onCompressedSdpReady = (base64, type) => {
  console.log(`[Main] Compressed ${type} SDP ready, length: ${base64.length}`);
  if (type === 'offer') {
    webrtcOfferSdp.value = base64;
  } else {
    webrtcAnswerSdp.value = base64;
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

// Preview Mode Change
previewModeSelect.addEventListener('change', () => {
  const mode = previewModeSelect.value as PreviewMode;
  previewRenderer.setMode(mode);
  updatePreview();
});

// WebRTC: Initialize as Offerer
webrtcInitOffererBtn.addEventListener('click', async () => {
  try {
    uiManager.updateStatus('Initializing WebRTC (gathering ICE)...', 'normal');
    await webrtcManager.initializeAsOfferer();
    uiManager.updateStatus('Compressed offer ready. Copy and send to remote peer.', 'normal');
  } catch (err) {
    console.error('[Main] Failed to initialize as offerer:', err);
    uiManager.updateStatus('Failed to initialize WebRTC', 'error');
  }
});

// WebRTC: Initialize as Answerer
webrtcInitAnswererBtn.addEventListener('click', async () => {
  const offerBase64 = webrtcOfferSdp.value.trim();
  if (!offerBase64) {
    uiManager.updateStatus('Please paste compressed offer (base64) first', 'error');
    return;
  }

  try {
    uiManager.updateStatus('Initializing WebRTC as answerer (gathering ICE)...', 'normal');
    await webrtcManager.initializeAsAnswerer(offerBase64);
    uiManager.updateStatus('Compressed answer ready. Copy and send to remote peer.', 'normal');
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
  const answerBase64 = webrtcAnswerSdp.value.trim();
  if (!answerBase64) {
    uiManager.updateStatus('Please paste compressed answer (base64) first', 'error');
    return;
  }

  try {
    uiManager.updateStatus('Setting remote answer...', 'normal');
    await webrtcManager.setRemoteAnswer(answerBase64);
    uiManager.updateStatus('Remote answer set. Connection establishing...', 'normal');
  } catch (err) {
    console.error('[Main] Failed to set answer:', err);
    uiManager.updateStatus('Failed to set answer', 'error');
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
