/**
 * Readable (JSON) format serializer
 */

import type { TrackingData } from '../types';
import { VERSION_STRING } from './version';

/**
 * Serialize tracking data to Readable (JSON) format
 */
export function serializeReadable(data: TrackingData): string {
  // Convert BlendShapeData array to Record for JSON output
  const blendShapeObj: Record<string, number> = {};
  data.blendShape.forEach((bs) => {
    blendShapeObj[bs.name] = bs.value;
  });

  const output = {
    version: VERSION_STRING,
    headPose: {
      px: data.headPose.px,
      py: data.headPose.py,
      pz: data.headPose.pz,
      rx: data.headPose.rx,
      ry: data.headPose.ry,
      rz: data.headPose.rz,
      rw: data.headPose.rw
    },
    blendShape: blendShapeObj
  };

  return JSON.stringify(output);
}
