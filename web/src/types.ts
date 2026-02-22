/**
 * Type definitions for VMM Tracker Data Sender
 */

/**
 * Video source state
 */
export enum VideoSourceState {
  None = 'None',
  Busy = 'Busy',
  CameraRunning = 'CameraRunning',
  VideoRunning = 'VideoRunning',
  VideoStopped = 'VideoStopped'
}

/**
 * Head pose data (position + rotation as quaternion)
 */
export interface HeadPose {
  px: number;
  py: number;
  pz: number;
  rx: number; // quaternion x
  ry: number; // quaternion y
  rz: number; // quaternion z
  rw: number; // quaternion w
}

/**
 * Single BlendShape entry
 */
export interface BlendShapeEntry {
  name: string;
  value: number; // 0-255
}

/**
 * BlendShape data (array of 52 entries, preserving order)
 */
export type BlendShapeData = BlendShapeEntry[];

/**
 * Complete tracking data (version is managed separately in serializers)
 */
export interface TrackingData {
  headPose: HeadPose;
  blendShape: BlendShapeData;
}

/**
 * Serialization format
 */
export type SerializationFormat = 'readable' | 'compressed';

/**
 * Status message type
 */
export type StatusType = 'normal' | 'connected' | 'error';

/**
 * Preview mode for video display
 */
export enum PreviewMode {
  DataOnly = 'data-only',
  Landmarks = 'landmarks',
  Camera = 'camera'
}

/**
 * Tracking status
 */
export enum TrackingStatus {
  NotTracking = 'not-tracking',
  TrackingNoFace = 'tracking-no-face',
  TrackingSuccess = 'tracking-success'
}

/**
 * Euler angles (in degrees)
 */
export interface EulerAngles {
  pitch: number; // up/down rotation
  yaw: number;   // left/right rotation
  roll: number;  // tilt rotation
}

/**
 * WebRTC connection state
 */
export enum WebRTCConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Failed = 'failed'
}

/**
 * WebRTC DataChannel state
 */
export enum WebRTCDataChannelState {
  Connecting = 'connecting',
  Open = 'open',
  Closing = 'closing',
  Closed = 'closed'
}

/**
 * Signaling data for manual SDP exchange (Phase 1)
 */
export interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}
