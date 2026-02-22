/**
 * VMM Tracker Data Sender - Web Application
 * Face tracking using MediaPipe and data transmission via WebRTC
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
import { parseFragment } from './signaling-url';
import { encryptAnswer } from './signaling-crypto';
import { putAnswer } from './signaling-api';

// ============================================================================
// UI Elements
// ============================================================================

const video = document.getElementById('video') as HTMLVideoElement;
const previewCanvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
const previewOverlay = document.getElementById('preview-overlay') as HTMLDivElement;

const webrtcFormatSelect = document.getElementById('webrtc-format-select') as HTMLSelectElement;
const previewModeSelect = document.getElementById('preview-mode-select') as HTMLSelectElement;
const startCameraBtn = document.getElementById('start-camera-btn') as HTMLButtonElement;
const stopTrackingBtn = document.getElementById('stop-tracking-btn') as HTMLButtonElement;
const statusSpan = document.getElementById('status') as HTMLSpanElement;
const connectionStatus = document.getElementById('connection-status') as HTMLSpanElement;

// Connection modal elements
const connectionModal = document.getElementById('connection-modal') as HTMLDivElement;
const connectionModalMessage = document.getElementById('connection-modal-message') as HTMLParagraphElement;
const connectionModalClose = document.getElementById('connection-modal-close') as HTMLButtonElement;

// ============================================================================
// Manager Instances
// ============================================================================

const videoSourceManager = new VideoSourceManager(video);
const mediapipeManager = new MediaPipeManager();
const webrtcManager = new WebRTCManager();
const uiManager = new UIManager(
  statusSpan,
  startCameraBtn,
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
// Connection Modal Helpers
// ============================================================================

let connectionModalCloseCallback: (() => void) | null = null;

function showConnectionModal(message: string, showCloseButton: boolean): void {
  connectionModalMessage.textContent = message;
  connectionModalClose.style.display = showCloseButton ? '' : 'none';
  connectionModal.classList.add('open');
}

function hideConnectionModal(): void {
  connectionModal.classList.remove('open');
}

connectionModalClose.addEventListener('click', () => {
  hideConnectionModal();
  if (connectionModalCloseCallback) {
    connectionModalCloseCallback();
    connectionModalCloseCallback = null;
  }
});

// ============================================================================
// Camera Auto-Start
// ============================================================================

async function startCameraAndTracking(): Promise<void> {
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
}

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
  const format = webrtcFormatSelect.value as SerializationFormat;
  webrtcManager.sendTrackingData(data, format);

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
  connectionStatus.className = 'status';
  if (state === 'connected') {
    connectionStatus.textContent = 'Connected';
    connectionStatus.classList.add('connected');
  } else if (state === 'failed') {
    connectionStatus.textContent = 'Connection failed';
    connectionStatus.classList.add('error');
  } else {
    connectionStatus.textContent = `Connection: ${state}`;
  }
};

webrtcManager.onDataChannelStateChange = (state) => {
  console.log('[Main] WebRTC data channel state:', state);
  if (state === 'open') {
    uiManager.updateStatus('DataChannel open', 'connected');
  } else if (state === 'closed') {
    uiManager.updateStatus('DataChannel closed', 'normal');
  }
};

webrtcManager.onCompressedSdpReady = (data, type) => {
  console.log(`[Main] Compressed ${type} SDP ready, length: ${data.length}`);
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

// Start Camera (manual fallback)
startCameraBtn.addEventListener('click', () => {
  startCameraAndTracking();
});

// Stop Tracking
stopTrackingBtn.addEventListener('click', () => {
  uiManager.updateButtonStates(VideoSourceState.Busy);

  try {
    mediapipeManager.stopTracking();

    const state = videoSourceManager.getState();
    if (state === VideoSourceState.CameraRunning) {
      videoSourceManager.stop();
      uiManager.updateStatus('Camera stopped', 'normal');
    } else if (state === VideoSourceState.VideoRunning) {
      videoSourceManager.pause();
      uiManager.updateStatus('Video paused', 'normal');
    }
  } catch (err) {
    console.error('[Main] Failed to stop tracking:', err);
    uiManager.updateStatus('Failed to stop tracking', 'error');
  }
});

// ============================================================================
// Auto-Signaling (URL fragment-based)
// ============================================================================

async function tryAutoSignaling(): Promise<void> {
  const parsed = parseFragment(window.location.hash);
  if (!parsed) return;

  const { token, aesKey, offerBytes } = parsed;

  showConnectionModal('接続中...', false);

  try {
    // Set up a promise to capture the compressed answer
    const answerReady = new Promise<Uint8Array>((resolve) => {
      const originalHandler = webrtcManager.onCompressedSdpReady;
      webrtcManager.onCompressedSdpReady = (data, type) => {
        if (type === 'answer') {
          resolve(data);
        }
        if (originalHandler) originalHandler(data, type);
      };
    });

    await webrtcManager.initializeAsAnswerer(offerBytes);

    const answerBytes = await answerReady;

    showConnectionModal('応答を暗号化・送信中...', false);

    // Encrypt the answer
    const encrypted = await encryptAnswer(aesKey, answerBytes);

    // Convert to standard base64 for API
    let binary = '';
    for (let i = 0; i < encrypted.length; i++) {
      binary += String.fromCharCode(encrypted[i]!);
    }
    const encryptedBase64 = btoa(binary);

    // Send to Firebase
    await putAnswer(token, encryptedBase64);

    // Remove fragment from URL to prevent re-triggering on reload
    history.replaceState(null, '', window.location.pathname + window.location.search);

    // Success: hide modal and start camera
    hideConnectionModal();
    await startCameraAndTracking();

  } catch (err) {
    console.error('[AutoSignaling] Failed:', err);
    const errorMessage = `接続に失敗しました: ${err instanceof Error ? err.message : String(err)}\n\nQRコードを再スキャンするか、閉じてローカルプレビューを使用してください。`;
    showConnectionModal(errorMessage, true);
    connectionModalCloseCallback = () => {
      startCameraAndTracking();
    };
  }
}

// ============================================================================
// Initialization
// ============================================================================

uiManager.updateButtonStates(VideoSourceState.None);

if (window.location.hash && parseFragment(window.location.hash)) {
  // Auto mode: fragment present
  tryAutoSignaling();
} else {
  // No-fragment mode: show info dialog
  showConnectionModal(
    'PCのQRコードをスキャンして接続してください。\nこのまま続けるとローカルプレビューのみ使用できます。',
    true
  );
  connectionModalCloseCallback = () => {
    startCameraAndTracking();
  };
}

// Initial preview render
updatePreview();
