/**
 * WebSocket Manager
 * Handles WebSocket connection and data transmission
 */

import type { TrackingData, SerializationFormat } from './types';
import { serializeReadable, serializeCompressed } from './serializers';

export class WebSocketManager {
  private websocket: WebSocket | null = null;

  // Event handlers
  public onOpen: (() => void) | null = null;
  public onClose: (() => void) | null = null;
  public onError: ((error: Event) => void) | null = null;

  /**
   * Adjust WebSocket protocol based on page protocol
   * HTTPS pages require wss://, HTTP pages can use ws://
   */
  private adjustWebSocketUrl(url: string): string {
    const isSecure = window.location.protocol === 'https:';

    // If URL starts with ws:// and page is HTTPS, convert to wss://
    if (isSecure && url.startsWith('ws://')) {
      console.warn('[WebSocket] Page is HTTPS, converting ws:// to wss://');
      return url.replace(/^ws:\/\//, 'wss://');
    }

    // If URL starts with wss:// and page is HTTP, convert to ws://
    if (!isSecure && url.startsWith('wss://')) {
      console.warn('[WebSocket] Page is HTTP, converting wss:// to ws://');
      return url.replace(/^wss:\/\//, 'ws://');
    }

    return url;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(url: string): Promise<void> {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      throw new Error('Already connected');
    }

    // Adjust protocol based on page security
    const adjustedUrl = this.adjustWebSocketUrl(url);
    console.log(`[WebSocket] Connecting to: ${adjustedUrl}`);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(adjustedUrl);
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
    trackingData: TrackingData,
    format: SerializationFormat
  ): void {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected, skipping send');
      return;
    }

    if (format === 'readable') {
      const data = serializeReadable(trackingData);
      this.websocket!.send(data);
    } else {
      const buffer = serializeCompressed(trackingData);
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
