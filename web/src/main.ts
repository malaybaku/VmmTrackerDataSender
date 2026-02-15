/**
 * VMM Tracker Data Sender - Web Application
 * Face tracking using MediaPipe and data transmission via WebSocket
 */

// UI Elements
const video = document.getElementById('video') as HTMLVideoElement;
const serverUrlInput = document.getElementById('server-url') as HTMLInputElement;
const formatSelect = document.getElementById('format-select') as HTMLSelectElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const startCameraBtn = document.getElementById('start-camera-btn') as HTMLButtonElement;
const startTrackingBtn = document.getElementById('start-tracking-btn') as HTMLButtonElement;
const statusSpan = document.getElementById('status') as HTMLSpanElement;

// State
let mediaStream: MediaStream | null = null;
let websocket: WebSocket | null = null;
let isTracking = false;

// Update status display
function updateStatus(message: string, type: 'normal' | 'connected' | 'error' = 'normal') {
  statusSpan.textContent = message;
  statusSpan.className = 'status';
  if (type === 'connected') statusSpan.classList.add('connected');
  if (type === 'error') statusSpan.classList.add('error');
}

// Start camera
startCameraBtn.addEventListener('click', async () => {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    video.srcObject = mediaStream;
    startCameraBtn.disabled = true;
    startTrackingBtn.disabled = false;
    updateStatus('Camera started', 'normal');
  } catch (err) {
    console.error('Failed to start camera:', err);
    updateStatus('Failed to start camera', 'error');
  }
});

// Connect to WebSocket server
connectBtn.addEventListener('click', () => {
  const url = serverUrlInput.value.trim();
  if (!url) {
    updateStatus('Please enter WebSocket URL', 'error');
    return;
  }

  try {
    websocket = new WebSocket(url);

    websocket.onopen = () => {
      updateStatus('Connected to server', 'connected');
      connectBtn.textContent = 'Disconnect';
    };

    websocket.onclose = () => {
      updateStatus('Disconnected from server', 'normal');
      connectBtn.textContent = 'Connect';
      websocket = null;
    };

    websocket.onerror = (err) => {
      console.error('WebSocket error:', err);
      updateStatus('WebSocket connection error', 'error');
    };
  } catch (err) {
    console.error('Failed to connect:', err);
    updateStatus('Failed to connect', 'error');
  }
});

// Start tracking
startTrackingBtn.addEventListener('click', () => {
  if (!isTracking) {
    startTracking();
    startTrackingBtn.textContent = 'Stop Tracking';
  } else {
    stopTracking();
    startTrackingBtn.textContent = 'Start Tracking';
  }
});

function startTracking() {
  isTracking = true;
  updateStatus('Tracking started - MediaPipe initialization pending', 'normal');

  // TODO: Initialize MediaPipe Face Landmarker
  // TODO: Start processing video frames
  // TODO: Send tracking data via WebSocket

  console.log('Tracking started with format:', formatSelect.value);
}

function stopTracking() {
  isTracking = false;
  updateStatus('Tracking stopped', 'normal');

  // TODO: Stop MediaPipe processing
}

// Initialize
updateStatus('Ready - Start camera and connect to server', 'normal');
