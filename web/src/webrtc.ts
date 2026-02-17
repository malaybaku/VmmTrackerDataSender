/**
 * WebRTC Manager
 * Manages WebRTC peer connection and data channel
 */

import type { TrackingData, SerializationFormat } from './types';
import { WebRTCConnectionState, WebRTCDataChannelState } from './types';
import { serializeReadable, serializeCompressed } from './serializers';
import { encodeSdp, decodeSdp, toBase64, fromBase64 } from './sdp-codec';

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectionState: WebRTCConnectionState = WebRTCConnectionState.Disconnected;
  private dataChannelState: WebRTCDataChannelState = WebRTCDataChannelState.Closed;

  // ICE gathering
  private collectedIceCandidates: RTCIceCandidate[] = [];
  private iceGatheringResolve: (() => void) | null = null;

  // Event handlers
  public onConnectionStateChange: ((state: WebRTCConnectionState) => void) | null = null;
  public onDataChannelStateChange: ((state: WebRTCDataChannelState) => void) | null = null;
  public onCompressedSdpReady: ((base64: string, type: 'offer' | 'answer') => void) | null = null;
  public onError: ((error: Error) => void) | null = null;

  /**
   * Initialize WebRTC peer connection as offerer
   */
  async initializeAsOfferer(): Promise<void> {
    console.log('[WebRTC] Initializing as offerer...');

    try {
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      this.setupPeerConnectionHandlers();

      this.dataChannel = this.peerConnection.createDataChannel('tracking-data', {
        ordered: true,
        maxRetransmits: 3
      });

      this.setupDataChannelHandlers();

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      console.log('[WebRTC] Offer created, waiting for ICE gathering...');
      this.updateConnectionState(WebRTCConnectionState.Connecting);

      await this.waitForIceGathering();

      const compressed = encodeSdp(offer.sdp!, 'offer', this.collectedIceCandidates);
      const base64 = toBase64(compressed);
      console.log('[WebRTC] Compressed offer ready, base64 length:', base64.length);

      if (this.onCompressedSdpReady) {
        this.onCompressedSdpReady(base64, 'offer');
      }
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
  async initializeAsAnswerer(offerBase64: string): Promise<void> {
    console.log('[WebRTC] Initializing as answerer...');

    try {
      // Decode compressed offer
      const offerBytes = fromBase64(offerBase64);
      const { sdp: offerSdp } = decodeSdp(offerBytes);
      console.log('[WebRTC] Decoded offer SDP from base64');

      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      this.setupPeerConnectionHandlers();

      await this.peerConnection.setRemoteDescription({
        type: 'offer',
        sdp: offerSdp
      });

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      console.log('[WebRTC] Answer created, waiting for ICE gathering...');
      this.updateConnectionState(WebRTCConnectionState.Connecting);

      await this.waitForIceGathering();

      const compressed = encodeSdp(answer.sdp!, 'answer', this.collectedIceCandidates);
      const base64 = toBase64(compressed);
      console.log('[WebRTC] Compressed answer ready, base64 length:', base64.length);

      if (this.onCompressedSdpReady) {
        this.onCompressedSdpReady(base64, 'answer');
      }
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
   * Set remote description (answer from remote peer, as compressed base64)
   */
  async setRemoteAnswer(answerBase64: string): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      const answerBytes = fromBase64(answerBase64);
      const { sdp: answerSdp } = decodeSdp(answerBytes);
      console.log('[WebRTC] Decoded answer SDP from base64');

      await this.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });
      console.log('[WebRTC] Remote answer set');
    } catch (error) {
      console.error('[WebRTC] Failed to set remote answer:', error);
      throw error;
    }
  }

  /**
   * Set up peer connection event handlers
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // Reset ICE gathering state
    this.collectedIceCandidates = [];
    this.iceGatheringResolve = null;

    // ICE candidate event - collect candidates internally
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate collected:', event.candidate.candidate);
        this.collectedIceCandidates.push(event.candidate);
      } else {
        console.log('[WebRTC] ICE gathering completed (null candidate)');
        if (this.iceGatheringResolve) {
          this.iceGatheringResolve();
          this.iceGatheringResolve = null;
        }
      }
    };

    // Backup: onicegatheringstatechange
    this.peerConnection.onicegatheringstatechange = () => {
      const state = this.peerConnection!.iceGatheringState;
      console.log('[WebRTC] ICE gathering state:', state);
      if (state === 'complete' && this.iceGatheringResolve) {
        this.iceGatheringResolve();
        this.iceGatheringResolve = null;
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
   * Wait for ICE gathering to complete or timeout
   */
  private waitForIceGathering(timeoutMs = 10000): Promise<void> {
    // Already complete
    if (this.peerConnection?.iceGatheringState === 'complete') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.iceGatheringResolve = resolve;

      setTimeout(() => {
        if (this.iceGatheringResolve) {
          console.warn('[WebRTC] ICE gathering timed out, proceeding with collected candidates');
          this.iceGatheringResolve = null;
          resolve();
        }
      }, timeoutMs);
    });
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

    this.collectedIceCandidates = [];
    this.iceGatheringResolve = null;

    this.updateConnectionState(WebRTCConnectionState.Disconnected);
    this.updateDataChannelState(WebRTCDataChannelState.Closed);
  }
}
