/**
 * Compressed (Binary) format serializer
 */

import type { HeadPose } from '../types';

/**
 * Serialize tracking data to Compressed (Binary) format
 */
export function serializeCompressed(
  headPose: HeadPose,
  blendShapes: Array<{ categoryName: string; score: number }>
): ArrayBuffer {
  const buffer = new ArrayBuffer(84);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  // Version (bytes 0-3)
  uint8View[0] = 1; // Major
  uint8View[1] = 0; // Minor
  uint8View[2] = 0; // Patch
  uint8View[3] = 0; // Reserved

  // Position (bytes 4-15)
  view.setFloat32(4, headPose.px, true);
  view.setFloat32(8, headPose.py, true);
  view.setFloat32(12, headPose.pz, true);

  // Rotation (bytes 16-31)
  view.setFloat32(16, headPose.rx, true);
  view.setFloat32(20, headPose.ry, true);
  view.setFloat32(24, headPose.rz, true);
  view.setFloat32(28, headPose.rw, true);

  // BlendShapes (bytes 32-83) - 52 values in protocol order
  for (let i = 0; i < Math.min(blendShapes.length, 52); i++) {
    uint8View[32 + i] = Math.round(blendShapes[i]!.score * 255);
  }

  return buffer;
}
