/**
 * WebRTC Manager
 * Manages WebRTC peer connection and data channel
 */

import type { TrackingData, SerializationFormat } from './types';
import { WebRTCConnectionState, WebRTCDataChannelState } from './types';
import { serializeReadable, serializeCompressed } from './serializers';

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectionState: WebRTCConnectionState = WebRTCConnectionState.Disconnected;
  private dataChannelState: WebRTCDataChannelState = WebRTCDataChannelState.Closed;

  // Event handlers
  public onConnectionStateChange: ((state: WebRTCConnectionState) => void) | null = null;
  public onDataChannelStateChange: ((state: WebRTCDataChannelState) => void) | null = null;
  public onOfferGenerated: ((sdp: string) => void) | null = null;
  public onAnswerGenerated: ((sdp: string) => void) | null = null;
  public onIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;
  public onError: ((error: Error) => void) | null = null;

  /**
   * Initialize WebRTC peer connection as offerer
   */
  async initializeAsOfferer(): Promise<void> {
    console.log('[WebRTC] Initializing as offerer...');

    try {
      // Create peer connection with STUN server
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      // Set up event handlers
      this.setupPeerConnectionHandlers();

      // Create data channel
      this.dataChannel = this.peerConnection.createDataChannel('tracking-data', {
        ordered: true,
        maxRetransmits: 3
      });

      // Set up data channel handlers
      this.setupDataChannelHandlers();

      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      console.log('[WebRTC] Offer created:', offer.sdp);

      // Emit offer SDP
      if (this.onOfferGenerated && offer.sdp) {
        this.onOfferGenerated(offer.sdp);
      }

      this.updateConnectionState(WebRTCConnectionState.Connecting);
    } catch (error) {
      console.error('[WebRTC] Failed to initialize as offerer:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.onError) {
        this.onError(err);
      }
      throw err;
    }
  }

  /**
   * Initialize WebRTC peer connection as answerer
   */
  async initializeAsAnswerer(offerSdp: string): Promise<void> {
    console.log('[WebRTC] Initializing as answerer...');

    try {
      // Create peer connection with STUN server
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      // Set up event handlers
      this.setupPeerConnectionHandlers();

      // Set remote description (offer)
      await this.peerConnection.setRemoteDescription({
        type: 'offer',
        sdp: this.normalizeSdp(offerSdp)
      });

      // Create answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      console.log('[WebRTC] Answer created:', answer.sdp);

      // Emit answer SDP
      if (this.onAnswerGenerated && answer.sdp) {
        this.onAnswerGenerated(answer.sdp);
      }

      this.updateConnectionState(WebRTCConnectionState.Connecting);
    } catch (error) {
      console.error('[WebRTC] Failed to initialize as answerer:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.onError) {
        this.onError(err);
      }
      throw err;
    }
  }

  /**
   * Set remote description (answer from remote peer)
   */
  async setRemoteAnswer(answerSdp: string): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: this.normalizeSdp(answerSdp)
      });
      console.log('[WebRTC] Remote answer set');
    } catch (error) {
      console.error('[WebRTC] Failed to set remote answer:', error);
      throw error;
    }
  }

  /**
   * Add ICE candidate from remote peer
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC] ICE candidate added:', candidate.candidate);
    } catch (error) {
      console.error('[WebRTC] Failed to add ICE candidate:', error);
      throw error;
    }
  }

  /**
   * Set up peer connection event handlers
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // ICE candidate event
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate:', event.candidate.candidate);
        if (this.onIceCandidate) {
          this.onIceCandidate(event.candidate);
        }
      } else {
        console.log('[WebRTC] ICE gathering completed');
      }
    };

    // Connection state change
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;
      console.log('[WebRTC] Connection state:', state);

      switch (state) {
        case 'connected':
          this.updateConnectionState(WebRTCConnectionState.Connected);
          break;
        case 'failed':
        case 'disconnected':
          this.updateConnectionState(WebRTCConnectionState.Failed);
          break;
        case 'connecting':
        case 'new':
          this.updateConnectionState(WebRTCConnectionState.Connecting);
          break;
      }
    };

    // Data channel event (for answerer)
    this.peerConnection.ondatachannel = (event) => {
      console.log('[WebRTC] Data channel received');
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };

    // ICE connection state change
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', this.peerConnection!.iceConnectionState);
    };
  }

  /**
   * Set up data channel event handlers
   */
  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('[WebRTC] Data channel opened');
      this.updateDataChannelState(WebRTCDataChannelState.Open);
    };

    this.dataChannel.onclose = () => {
      console.log('[WebRTC] Data channel closed');
      this.updateDataChannelState(WebRTCDataChannelState.Closed);
    };

    this.dataChannel.onerror = (error) => {
      console.error('[WebRTC] Data channel error:', error);
      if (this.onError) {
        this.onError(new Error('Data channel error'));
      }
    };

    this.dataChannel.onmessage = (event) => {
      console.log('[WebRTC] Data channel message received:', event.data);
      // For now, we only send data, not receive
    };
  }

  /**
   * Send tracking data via data channel
   */
  sendTrackingData(trackingData: TrackingData, format: SerializationFormat): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('[WebRTC] Data channel not open, skipping send');
      return;
    }

    try {
      if (format === 'readable') {
        const data = serializeReadable(trackingData);
        this.dataChannel.send(data);
      } else {
        const buffer = serializeCompressed(trackingData);
        this.dataChannel.send(buffer);
      }
    } catch (error) {
      console.error('[WebRTC] Failed to send tracking data:', error);
    }
  }

  /**
   * Check if data channel is open
   */
  isDataChannelOpen(): boolean {
    return this.dataChannel !== null && this.dataChannel.readyState === 'open';
  }

  /**
   * Get current connection state
   */
  getConnectionState(): WebRTCConnectionState {
    return this.connectionState;
  }

  /**
   * Get current data channel state
   */
  getDataChannelState(): WebRTCDataChannelState {
    return this.dataChannelState;
  }

  /**
   * Update connection state and notify listeners
   */
  private updateConnectionState(state: WebRTCConnectionState): void {
    this.connectionState = state;
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange(state);
    }
  }

  /**
   * Update data channel state and notify listeners
   */
  private updateDataChannelState(state: WebRTCDataChannelState): void {
    this.dataChannelState = state;
    if (this.onDataChannelStateChange) {
      this.onDataChannelStateChange(state);
    }
  }

  /**
   * Normalize SDP line endings for browser compatibility.
   * Ensures each line ends with \r\n, which Chrome's SDP parser requires.
   * Trailing newlines are often lost during copy-paste.
   */
  private normalizeSdp(sdp: string): string {
    const lines = sdp.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .split('\n')
      .filter(line => line.length > 0);
    return lines.join('\r\n') + '\r\n';
  }

  /**
   * Close connection
   */
  close(): void {
    console.log('[WebRTC] Closing connection...');

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.updateConnectionState(WebRTCConnectionState.Disconnected);
    this.updateDataChannelState(WebRTCDataChannelState.Closed);
  }
}
