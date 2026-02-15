/**
 * VMM Tracker Data Sender - Web Application
 * Face tracking using MediaPipe and data transmission via WebSocket
 */

import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

// UI Elements
const video = document.getElementById('video') as HTMLVideoElement;
const serverUrlInput = document.getElementById('server-url') as HTMLInputElement;
const formatSelect = document.getElementById('format-select') as HTMLSelectElement;
const videoSourceSelect = document.getElementById('video-source-select') as HTMLSelectElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const startVideoBtn = document.getElementById('start-video-btn') as HTMLButtonElement;
const videoFileInput = document.getElementById('video-file-input') as HTMLInputElement;
const startTrackingBtn = document.getElementById('start-tracking-btn') as HTMLButtonElement;
const statusSpan = document.getElementById('status') as HTMLSpanElement;

// State
let mediaStream: MediaStream | null = null;
let websocket: WebSocket | null = null;
let isTracking = false;
let faceLandmarker: FaceLandmarker | null = null;
let lastVideoTime = -1;

// Update status display
function updateStatus(message: string, type: 'normal' | 'connected' | 'error' = 'normal') {
  statusSpan.textContent = message;
  statusSpan.className = 'status';
  if (type === 'connected') statusSpan.classList.add('connected');
  if (type === 'error') statusSpan.classList.add('error');
}

// Initialize MediaPipe Face Landmarker
async function initializeMediaPipe() {
  try {
    console.log('Starting MediaPipe initialization...');
    updateStatus('Loading MediaPipe...', 'normal');

    console.log('Loading vision tasks from CDN...');
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    console.log('Vision tasks loaded');

    console.log('Creating Face Landmarker...');
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
        delegate: "GPU"
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 1
    });
    console.log('Face Landmarker created successfully');

    updateStatus('MediaPipe loaded successfully', 'normal');
    console.log('MediaPipe initialization complete');
    return true;
  } catch (error) {
    console.error('Failed to initialize MediaPipe:', error);
    updateStatus('Failed to load MediaPipe', 'error');
    return false;
  }
}

// Start video source (camera or file)
startVideoBtn.addEventListener('click', async () => {
  const source = videoSourceSelect.value;

  try {
    // Clear previous video sources
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    video.srcObject = null;
    video.src = '';
    video.load();

    if (source === 'camera') {
      // Camera source
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 }
        }
      });
      video.srcObject = mediaStream;
      await video.play();
      updateStatus('Camera started', 'normal');
    } else if (source === 'file') {
      // File selection
      videoFileInput.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          video.src = URL.createObjectURL(file);
          video.loop = true;
          await video.play();
          updateStatus('Video file loaded', 'normal');

          // Enable tracking button after video is loaded
          startVideoBtn.disabled = true;
          startTrackingBtn.disabled = false;
        }
      };
      videoFileInput.click();
      return; // Don't disable button yet, wait for file selection
    }

    startVideoBtn.disabled = true;
    startTrackingBtn.disabled = false;
  } catch (err) {
    console.error('Failed to start video source:', err);
    updateStatus(`Failed to start ${source}`, 'error');
  }
});

// Connect to WebSocket server
connectBtn.addEventListener('click', () => {
  const url = serverUrlInput.value.trim();
  console.log('Connect button clicked, URL:', url);

  if (!url) {
    updateStatus('Please enter WebSocket URL', 'error');
    return;
  }

  // Disconnect if already connected
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    console.log('Disconnecting existing connection');
    websocket.close();
    return;
  }

  try {
    console.log('Creating WebSocket connection to:', url);
    websocket = new WebSocket(url);

    websocket.onopen = () => {
      console.log('WebSocket connected successfully');
      updateStatus('Connected to server', 'connected');
      connectBtn.textContent = 'Disconnect';
    };

    websocket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      updateStatus('Disconnected from server', 'normal');
      connectBtn.textContent = 'Connect';
      websocket = null;
    };

    websocket.onerror = (err) => {
      console.error('WebSocket error:', err);
      updateStatus('WebSocket connection error', 'error');
    };
  } catch (err) {
    console.error('Failed to create WebSocket:', err);
    updateStatus('Failed to connect', 'error');
  }
});

// Start tracking
startTrackingBtn.addEventListener('click', () => {
  console.log('Start Tracking button clicked, isTracking:', isTracking);
  if (!isTracking) {
    startTracking();
    startTrackingBtn.textContent = 'Stop Tracking';
  } else {
    stopTracking();
    startTrackingBtn.textContent = 'Start Tracking';
  }
});

async function startTracking() {
  console.log('startTracking() called');

  // Start video playback if not already playing
  if (video.paused) {
    try {
      await video.play();
      console.log('Video playback started');
    } catch (err) {
      console.error('Failed to start video playback:', err);
      updateStatus('Failed to start video playback', 'error');
      return;
    }
  }

  // Initialize MediaPipe if not already initialized
  if (!faceLandmarker) {
    console.log('faceLandmarker not initialized, calling initializeMediaPipe()');
    const success = await initializeMediaPipe();
    if (!success) {
      console.log('MediaPipe initialization failed');
      return;
    }
  } else {
    console.log('faceLandmarker already initialized');
  }

  isTracking = true;
  updateStatus('Tracking started', 'connected');

  // Start processing video frames
  console.log('Starting video frame processing');
  processVideoFrame();

  console.log('Tracking started with format:', formatSelect.value);
}

// Process video frame and send tracking data
function processVideoFrame() {
  if (!isTracking || !faceLandmarker) {
    return;
  }

  // Only process if video time has changed (new frame)
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    try {
      const results = faceLandmarker.detectForVideo(video, performance.now());

      if (results.faceBlendshapes && results.faceBlendshapes.length > 0 &&
          results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
        sendTrackingData(results);
      }
    } catch (error) {
      console.error('Error processing frame:', error);
    }
  }

  // Continue processing
  requestAnimationFrame(processVideoFrame);
}

// Send tracking data from MediaPipe results
function sendTrackingData(results: FaceLandmarkerResult) {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) {
    return;
  }

  const blendShapes = results.faceBlendshapes[0]!.categories;
  const matrix = results.facialTransformationMatrixes[0]!.data;

  // Extract position from transformation matrix (column-major format)
  // Position is in the last column: matrix[12], matrix[13], matrix[14]
  const px = matrix[12]!;
  const py = matrix[13]!;
  const pz = matrix[14]!;

  // Extract rotation (convert matrix to quaternion)
  const quaternion = matrixToQuaternion(matrix);

  const format = formatSelect.value;

  if (format === 'readable') {
    sendReadableFormat(px, py, pz, quaternion, blendShapes);
  } else {
    sendCompressedFormat(px, py, pz, quaternion, blendShapes);
  }
}

// Convert 4x4 transformation matrix to quaternion
function matrixToQuaternion(m: number[]): { x: number; y: number; z: number; w: number } {
  // Extract rotation part from transformation matrix (top-left 3x3)
  const trace = m[0]! + m[5]! + m[10]!;

  let w, x, y, z;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    w = 0.25 * s;
    x = (m[6]! - m[9]!) / s;
    y = (m[8]! - m[2]!) / s;
    z = (m[1]! - m[4]!) / s;
  } else if (m[0]! > m[5]! && m[0]! > m[10]!) {
    const s = Math.sqrt(1.0 + m[0]! - m[5]! - m[10]!) * 2;
    w = (m[6]! - m[9]!) / s;
    x = 0.25 * s;
    y = (m[1]! + m[4]!) / s;
    z = (m[8]! + m[2]!) / s;
  } else if (m[5]! > m[10]!) {
    const s = Math.sqrt(1.0 + m[5]! - m[0]! - m[10]!) * 2;
    w = (m[8]! - m[2]!) / s;
    x = (m[1]! + m[4]!) / s;
    y = 0.25 * s;
    z = (m[6]! + m[9]!) / s;
  } else {
    const s = Math.sqrt(1.0 + m[10]! - m[0]! - m[5]!) * 2;
    w = (m[1]! - m[4]!) / s;
    x = (m[8]! + m[2]!) / s;
    y = (m[6]! + m[9]!) / s;
    z = 0.25 * s;
  }

  return { x, y, z, w };
}

// Send data in Readable format (JSON)
function sendReadableFormat(
  px: number,
  py: number,
  pz: number,
  quaternion: { x: number; y: number; z: number; w: number },
  blendShapes: Array<{ categoryName: string; score: number }>
) {
  const blendShapeObj: Record<string, number> = {};

  blendShapes.forEach((bs) => {
    blendShapeObj[bs.categoryName] = Math.round(bs.score * 255);
  });

  const data = {
    version: "1.0.0",
    headPose: {
      px,
      py,
      pz,
      rx: quaternion.x,
      ry: quaternion.y,
      rz: quaternion.z,
      rw: quaternion.w
    },
    blendShape: blendShapeObj
  };

  websocket!.send(JSON.stringify(data));
}

// Send data in Compressed format (Binary)
function sendCompressedFormat(
  px: number,
  py: number,
  pz: number,
  quaternion: { x: number; y: number; z: number; w: number },
  blendShapes: Array<{ categoryName: string; score: number }>
) {
  const buffer = new ArrayBuffer(84);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  // Version (bytes 0-3)
  uint8View[0] = 1; // Major
  uint8View[1] = 0; // Minor
  uint8View[2] = 0; // Patch
  uint8View[3] = 0; // Reserved

  // Position (bytes 4-15)
  view.setFloat32(4, px, true);
  view.setFloat32(8, py, true);
  view.setFloat32(12, pz, true);

  // Rotation (bytes 16-31)
  view.setFloat32(16, quaternion.x, true);
  view.setFloat32(20, quaternion.y, true);
  view.setFloat32(24, quaternion.z, true);
  view.setFloat32(28, quaternion.w, true);

  // BlendShapes (bytes 32-83) - 52 values in protocol order
  for (let i = 0; i < Math.min(blendShapes.length, 52); i++) {
    uint8View[32 + i] = Math.round(blendShapes[i]!.score * 255);
  }

  websocket!.send(buffer);
}

function stopTracking() {
  isTracking = false;
  updateStatus('Tracking stopped', 'normal');

  // TODO: Stop MediaPipe processing
}

// Debug mode auto-start (development only)
async function autoStartDebugMode() {
  // Only in development environment
  if (!import.meta.env.DEV) {
    return;
  }

  try {
    // Check if debug video exists
    const debugVideoPath = '/test-data/debug-video.mp4';
    const response = await fetch(debugVideoPath, { method: 'HEAD' });

    if (!response.ok) {
      // Debug video not found, skip auto-start
      console.log('[DEBUG] No debug-video.mp4 found, skipping auto-start');
      return;
    }

    console.log('[DEBUG] Auto-starting with debug-video.mp4...');
    updateStatus('Loading debug video...', 'normal');

    // 1. Load debug video (without playing - autoplay policy)
    video.src = debugVideoPath;
    video.loop = true;
    console.log('[DEBUG] Video loaded (not playing yet)');

    // Enable tracking button (keep Start Video enabled for camera/file switching)
    startTrackingBtn.disabled = false;

    // 2. Connect to WebSocket
    const wsUrl = serverUrlInput.value.trim() || 'ws://localhost:9090';
    console.log('[DEBUG] Connecting to WebSocket:', wsUrl);

    websocket = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);

      websocket!.onopen = () => {
        clearTimeout(timeout);
        console.log('[DEBUG] WebSocket connected');
        updateStatus('Debug ready - Click "Start Tracking" to begin', 'connected');
        connectBtn.textContent = 'Disconnect';
        resolve();
      };

      websocket!.onerror = (err) => {
        clearTimeout(timeout);
        console.error('[DEBUG] WebSocket connection failed:', err);
        reject(err);
      };
    });

    // Set up WebSocket close handler
    websocket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      updateStatus('Disconnected from server', 'normal');
      connectBtn.textContent = 'Connect';
      websocket = null;
    };

    console.log('[DEBUG] Auto-start complete! Click "Start Tracking" to begin 🎉');

  } catch (err) {
    console.log('[DEBUG] Auto-start failed:', err);
    updateStatus('Debug auto-start failed - use manual controls', 'error');

    // Clean up on failure
    if (websocket) {
      websocket.close();
      websocket = null;
    }

    // Restore UI to initial state
    video.src = '';
    video.srcObject = null;
    startVideoBtn.disabled = false;
    startTrackingBtn.disabled = true;
    connectBtn.textContent = 'Connect';
  }
}

// Initialize
updateStatus('Ready - Start camera and connect to server', 'normal');

// Auto-start debug mode if in development
autoStartDebugMode();
