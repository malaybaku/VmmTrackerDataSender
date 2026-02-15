/**
 * Compressed (Binary) format serializer
 */

import type { TrackingData } from '../types';
import { VERSION_BYTES } from './version';

/**
 * Serialize tracking data to Compressed (Binary) format
 */
export function serializeCompressed(data: TrackingData): ArrayBuffer {
  const buffer = new ArrayBuffer(84);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  // Version (bytes 0-3)
  uint8View[0] = VERSION_BYTES.major;
  uint8View[1] = VERSION_BYTES.minor;
  uint8View[2] = VERSION_BYTES.patch;
  uint8View[3] = VERSION_BYTES.reserved;

  // Position (bytes 4-15)
  view.setFloat32(4, data.headPose.px, true);
  view.setFloat32(8, data.headPose.py, true);
  view.setFloat32(12, data.headPose.pz, true);

  // Rotation (bytes 16-31)
  view.setFloat32(16, data.headPose.rx, true);
  view.setFloat32(20, data.headPose.ry, true);
  view.setFloat32(24, data.headPose.rz, true);
  view.setFloat32(28, data.headPose.rw, true);

  // BlendShapes (bytes 32-83) - 52 values in protocol order
  // Array order is preserved from MediaPipe
  for (let i = 0; i < Math.min(data.blendShape.length, 52); i++) {
    uint8View[32 + i] = data.blendShape[i]!.value;
  }

  return buffer;
}
