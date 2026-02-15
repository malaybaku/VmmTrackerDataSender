/**
 * Type definitions for VMM Tracker Data Sender
 */

/**
 * Video source state
 */
export enum VideoSourceState {
  None = 'None',
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
 * BlendShape data (52 values, 0-255)
 */
export type BlendShapeData = Record<string, number>;

/**
 * Complete tracking data
 */
export interface TrackingData {
  version: string;
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
