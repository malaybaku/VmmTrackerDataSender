/**
 * Math utilities for coordinate transformations
 */

import type { EulerAngles } from '../types';

/**
 * Convert quaternion to Euler angles (in degrees)
 * Assumes MediaPipe coordinate system (right-handed, Y-down)
 * Returns angles in degrees with Yaw-Pitch-Roll order
 */
export function quaternionToEuler(quat: { x: number; y: number; z: number; w: number }): EulerAngles {
  const { x, y, z, w } = quat;

  // Yaw (Y-axis rotation)
  const sinYaw = 2 * (w * y - z * x);
  const cosYaw = 1 - 2 * (x * x + y * y);
  const yaw = Math.atan2(sinYaw, cosYaw);

  // Pitch (X-axis rotation)
  const sinPitch = 2 * (w * x + y * z);
  const pitch = Math.asin(Math.max(-1, Math.min(1, sinPitch)));

  // Roll (Z-axis rotation)
  const sinRoll = 2 * (w * z - x * y);
  const cosRoll = 1 - 2 * (y * y + z * z);
  const roll = Math.atan2(sinRoll, cosRoll);

  return {
    pitch: radToDeg(pitch),
    yaw: radToDeg(yaw),
    roll: radToDeg(roll)
  };
}

/**
 * Convert radians to degrees
 */
export function radToDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

/**
 * Format floating point number to specified decimal places
 */
export function formatFloat(val: number, decimals: number): string {
  return val.toFixed(decimals);
}

/**
 * Format number to fixed width (6 characters) for stable UI display
 * Always shows sign (+/-) and pads to 6 characters total
 * Examples: "+012.3", "-999.9", "+000.0"
 */
export function formatFixedWidth(val: number): string {
  const sign = val >= 0 ? '+' : '-';
  const absVal = Math.abs(val);
  const str = absVal.toFixed(1);

  // Pad with zeros to ensure total width of 6 characters including sign
  // Format: [sign][digits].[decimal]
  // Example: +012.3 (6 chars), -999.9 (6 chars)
  const parts = str.split('.');
  const intPart = parts[0]!.padStart(3, '0');
  const decPart = parts[1]!;

  return `${sign}${intPart}.${decPart}`;
}
