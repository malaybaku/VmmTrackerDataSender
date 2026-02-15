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
