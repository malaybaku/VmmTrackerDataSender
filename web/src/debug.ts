/**
 * Debug Mode
 * Auto-start functionality for development environment
 */

import { VideoSourceManager } from './videoSource';
import { WebSocketManager } from './websocket';
import { UIManager } from './ui';

/**
 * Auto-start debug mode in development environment
 */
export async function autoStartDebugMode(
  videoSourceManager: VideoSourceManager,
  websocketManager: WebSocketManager,
  uiManager: UIManager,
  serverUrl: string
): Promise<void> {
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
    uiManager.updateStatus('Loading debug video...', 'normal');

    // 1. Load debug video (without playing - autoplay policy)
    await videoSourceManager.startVideoUrl(debugVideoPath);
    console.log('[DEBUG] Video loaded (not playing)');

    // 2. Connect to WebSocket
    const wsUrl = serverUrl || 'ws://localhost:9090';
    console.log('[DEBUG] Connecting to WebSocket:', wsUrl);

    websocketManager.onOpen = () => {
      console.log('[DEBUG] WebSocket connected');
      uiManager.setConnectButtonText('Disconnect');
    };

    websocketManager.onClose = () => {
      console.log('[DEBUG] WebSocket closed');
      uiManager.updateStatus('Disconnected from server', 'normal');
      uiManager.setConnectButtonText('Connect');
    };

    websocketManager.onError = (err) => {
      console.error('[DEBUG] WebSocket connection failed:', err);
    };

    await websocketManager.connect(wsUrl);

    // Update UI
    uiManager.updateStatus('Debug ready - Click "Restart Video" to begin', 'connected');
    console.log('[DEBUG] Auto-start complete! Click "Restart Video" to begin');

  } catch (err) {
    console.log('[DEBUG] Auto-start failed:', err);
    uiManager.updateStatus('Debug auto-start failed - use manual controls', 'error');

    // Clean up on failure
    websocketManager.disconnect();
    videoSourceManager.stop();
    videoSourceManager.clearVideoReferences();
    uiManager.setConnectButtonText('Connect');
  }
}
