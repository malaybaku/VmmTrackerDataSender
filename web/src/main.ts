/**
 * VMM Tracker Data Sender - Web Application
 * Face tracking using MediaPipe and data transmission via WebRTC
 */

import { PreviewMode, TrackingStatus } from './types';
import type { HeadPose, EulerAngles } from './types';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { VideoSourceManager } from './videoSource';
import { MediaPipeManager } from './mediapipe';
import { WebRTCManager } from './webrtc';
import { PreviewRenderer } from './previewRenderer';
import { quaternionToEuler } from './utils/math';
import { parseFragment } from './signaling-url';
import { encryptAnswer } from './signaling-crypto';
import { putAnswer } from './signaling-api';
import { t, getLanguage, setLanguage } from './i18n/messages';

// ============================================================================
// UI Elements
// ============================================================================

const video = document.getElementById('video') as HTMLVideoElement;
const previewCanvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
const previewOverlay = document.getElementById('preview-overlay') as HTMLDivElement;

const previewModeSelect = document.getElementById('preview-mode-select') as HTMLSelectElement;
const restartTrackingBtn = document.getElementById('restart-tracking-btn') as HTMLButtonElement;
const connectionStatus = document.getElementById('connection-status') as HTMLSpanElement;

// Connection modal elements
const connectionModal = document.getElementById('connection-modal') as HTMLDivElement;
const connectionModalMessage = document.getElementById('connection-modal-message') as HTMLParagraphElement;
const connectionModalClose = document.getElementById('connection-modal-close') as HTMLButtonElement;
const connectionModalConsent = document.getElementById('connection-modal-consent') as HTMLDivElement;
const connectionModalSetupBtn = document.getElementById('connection-modal-setup-btn') as HTMLButtonElement;

// ============================================================================
// Manager Instances
// ============================================================================

const videoSourceManager = new VideoSourceManager(video);
const mediapipeManager = new MediaPipeManager();
const webrtcManager = new WebRTCManager();
const previewRenderer = new PreviewRenderer(previewCanvas, previewOverlay, video);

// ============================================================================
// State Management for Preview
// ============================================================================

let currentTrackingStatus: TrackingStatus = TrackingStatus.TrackingNoFace;
let currentHeadPose: HeadPose | null = null;
let currentEuler: EulerAngles | null = null;
let currentLandmarks: NormalizedLandmark[] | null = null;

// ============================================================================
// Connection Modal Helpers
// ============================================================================

let connectionModalCloseCallback: (() => void) | null = null;
let connectionModalSetupCallback: (() => void) | null = null;

function showConnectionModal(message: string, options?: {
  showCloseButton?: boolean;
  showConsentUI?: boolean;
}): void {
  connectionModalMessage.textContent = message;
  connectionModalClose.style.display = options?.showCloseButton ? '' : 'none';
  connectionModalConsent.style.display = options?.showConsentUI ? '' : 'none';
  connectionModal.classList.add('open');
}

function hideConnectionModal(): void {
  connectionModal.classList.remove('open');
  connectionModalConsent.style.display = 'none';
}

connectionModalClose.addEventListener('click', () => {
  hideConnectionModal();
  if (connectionModalCloseCallback) {
    connectionModalCloseCallback();
    connectionModalCloseCallback = null;
  }
});

connectionModalSetupBtn.addEventListener('click', () => {
  connectionModalSetupBtn.disabled = true;
  if (connectionModalSetupCallback) {
    connectionModalSetupCallback();
    connectionModalSetupCallback = null;
  }
});

// ============================================================================
// Camera Auto-Start
// ============================================================================

async function startCameraAndTracking(): Promise<void> {
  try {
    console.log('[Main] Starting camera...');
    await videoSourceManager.startCamera();

    console.log('[Main] Starting tracking...');
    await mediapipeManager.startTracking(video);

    console.log('[Main] Camera tracking successfully started');
  } catch (err) {
    console.error('[Main] Failed to start camera tracking:', err);
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      alert(t('error.cameraNotAllowed'));
    }
    videoSourceManager.stop();
  }
}

// ============================================================================
// Event Handlers Setup
// ============================================================================

// Video Source State Changes
videoSourceManager.onStateChange = () => {
  // State tracked internally; no UI buttons to update
};

// MediaPipe Events
mediapipeManager.onInitialized = () => {
  console.log('[Main] MediaPipe loaded successfully');
};

mediapipeManager.onError = (error) => {
  console.error('[Main] MediaPipe error:', error);
};

mediapipeManager.onTrackingData = (data) => {
  webrtcManager.sendTrackingData(data, 'compressed');

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
    connectionStatus.textContent = t('status.connected');
    connectionStatus.classList.add('connected');
  } else if (state === 'failed') {
    connectionStatus.textContent = t('status.connectionFailed');
    connectionStatus.classList.add('error');
  } else {
    connectionStatus.textContent = t('status.connectionPrefix') + state;
  }
};

webrtcManager.onDataChannelStateChange = (state) => {
  console.log('[Main] WebRTC data channel state:', state);
  if (state === 'open') {
    connectionStatus.textContent = t('status.connected');
    connectionStatus.className = 'status connected';
  }
};

webrtcManager.onCompressedSdpReady = (data, type) => {
  console.log(`[Main] Compressed ${type} SDP ready, length: ${data.length}`);
};

webrtcManager.onError = (error) => {
  console.error('[Main] WebRTC error:', error);
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
    updatePreview();
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

// Restart Tracking
restartTrackingBtn.addEventListener('click', async () => {
  restartTrackingBtn.disabled = true;
  try {
    mediapipeManager.stopTracking();
    videoSourceManager.stop();
    await startCameraAndTracking();
  } finally {
    restartTrackingBtn.disabled = false;
  }
});

// ============================================================================
// Auto-Signaling (URL fragment-based)
// ============================================================================

async function tryAutoSignaling(): Promise<void> {
  const parsed = parseFragment(window.location.hash);
  if (!parsed) return;

  const { token, aesKey, offerBytes } = parsed;

  showConnectionModal(t('modal.connecting'));

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

    // Encrypt the answer (prepare before user consent)
    const encrypted = await encryptAnswer(aesKey, answerBytes);

    // Convert to standard base64 for API
    let binary = '';
    for (let i = 0; i < encrypted.length; i++) {
      binary += String.fromCharCode(encrypted[i]!);
    }
    const encryptedBase64 = btoa(binary);

    // Show consent UI and wait for user to tap the setup button
    showConnectionModal(t('modal.connectionReady'), { showConsentUI: true });

    await new Promise<void>((resolve, reject) => {
      connectionModalSetupCallback = async () => {
        try {
          showConnectionModal(t('modal.sendingAnswer'));

          // Send to Firebase
          await putAnswer(token, encryptedBase64);

          // Remove fragment from URL to prevent re-triggering on reload
          history.replaceState(null, '', window.location.pathname + window.location.search);

          // Success: hide modal and start camera
          hideConnectionModal();
          await startCameraAndTracking();
          resolve();
        } catch (err) {
          reject(err);
        }
      };
    });

  } catch (err) {
    console.error('[AutoSignaling] Failed:', err);
    const errorMessage = t('modal.connectionFailed', { error: err instanceof Error ? err.message : String(err) });
    showConnectionModal(errorMessage, { showCloseButton: true });
    connectionModalCloseCallback = () => {
      startCameraAndTracking();
    };
  }
}

// ============================================================================
// i18n: Apply translated text to DOM elements
// ============================================================================

const previewLabel = document.querySelector('#controls .control-panel label') as HTMLLabelElement;
const footerLinks = document.querySelectorAll('.footer a');
const consentMsg = document.querySelector('#connection-modal-consent p') as HTMLParagraphElement;
const langSwitch = document.getElementById('lang-switch') as HTMLSpanElement;

let isNoQrMode = false;

function applyI18n(): void {
  // Header
  (document.getElementById('app-title') as HTMLSpanElement).textContent = t('header.title');

  // Update no-QR header hint if applicable
  if (isNoQrMode && !connectionStatus.classList.contains('connected')) {
    connectionStatus.textContent = t('status.noQr');
  }

  // Preview controls
  previewLabel.textContent = t('label.preview');
  previewModeSelect.options[0]!.textContent = t('preview.dataOnly');
  previewModeSelect.options[1]!.textContent = t('preview.landmarks');
  previewModeSelect.options[2]!.textContent = t('preview.camera');
  restartTrackingBtn.textContent = t('btn.restart');

  // Footer links
  footerLinks[0]!.textContent = t('footer.sourceGithub');
  footerLinks[1]!.textContent = t('footer.licenses');
  footerLinks[2]!.textContent = t('footer.privacyPolicy');

  // Connection modal
  connectionModalClose.textContent = t('btn.ok');
  connectionModalSetupBtn.textContent = t('btn.setupConnection');
  consentMsg.innerHTML = t('consent.message');

  // Language switch active state
  const lang = getLanguage();
  langSwitch.querySelectorAll('.lang-option').forEach((el) => {
    el.classList.toggle('active', (el as HTMLElement).dataset.lang === lang);
  });
}

applyI18n();

// Language switch click handler
langSwitch.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('[data-lang]') as HTMLElement | null;
  if (!target) return;
  const lang = target.dataset.lang as 'ja' | 'en';
  if (lang === getLanguage()) return;
  setLanguage(lang);
  applyI18n();
});

// ============================================================================
// Initialization
// ============================================================================

if (window.location.hash && parseFragment(window.location.hash)) {
  // Auto mode: fragment present
  tryAutoSignaling();
} else {
  // No-fragment mode: show info dialog and persist header hint
  isNoQrMode = true;
  connectionStatus.textContent = t('status.noQr');
  connectionStatus.className = 'status';

  showConnectionModal(
    t('modal.initialInfo'),
    { showCloseButton: true }
  );
  connectionModalCloseCallback = () => {
    startCameraAndTracking();
  };
}

// Initial preview render
updatePreview();
