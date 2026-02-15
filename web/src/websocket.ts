/**
 * WebSocket Manager
 * Handles WebSocket connection and data transmission
 */

import type { HeadPose, SerializationFormat } from './types';
import { serializeReadable, serializeCompressed } from './serializers';

export class WebSocketManager {
  private websocket: WebSocket | null = null;

  // Event handlers
  public onOpen: (() => void) | null = null;
  public onClose: (() => void) | null = null;
  public onError: ((error: Event) => void) | null = null;

  /**
   * Connect to WebSocket server
   */
  async connect(url: string): Promise<void> {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      throw new Error('Already connected');
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        this.websocket = ws;
        if (this.onOpen) this.onOpen();
        resolve();
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        if (this.onError) this.onError(err);
        reject(err);
      };

      ws.onclose = () => {
        this.websocket = null;
        if (this.onClose) this.onClose();
      };
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.websocket !== null && this.websocket.readyState === WebSocket.OPEN;
  }

  /**
   * Send tracking data
   */
  sendTrackingData(
    headPose: HeadPose,
    blendShapes: Array<{ categoryName: string; score: number }>,
    format: SerializationFormat
  ): void {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected, skipping send');
      return;
    }

    if (format === 'readable') {
      const data = serializeReadable(headPose, blendShapes);
      this.websocket!.send(data);
    } else {
      const buffer = serializeCompressed(headPose, blendShapes);
      this.websocket!.send(buffer);
    }
  }

  /**
   * Send raw data (for compatibility)
   */
  send(data: string | ArrayBuffer): void {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected, skipping send');
      return;
    }
    this.websocket!.send(data);
  }
}
