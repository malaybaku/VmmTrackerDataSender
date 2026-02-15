/**
 * Readable (JSON) format serializer
 */

import type { HeadPose, BlendShapeData } from '../types';

/**
 * Serialize tracking data to Readable (JSON) format
 */
export function serializeReadable(
  headPose: HeadPose,
  blendShapes: Array<{ categoryName: string; score: number }>
): string {
  const blendShapeObj: BlendShapeData = {};

  blendShapes.forEach((bs) => {
    blendShapeObj[bs.categoryName] = Math.round(bs.score * 255);
  });

  const data = {
    version: "1.0.0",
    headPose: {
      px: headPose.px,
      py: headPose.py,
      pz: headPose.pz,
      rx: headPose.rx,
      ry: headPose.ry,
      rz: headPose.rz,
      rw: headPose.rw
    },
    blendShape: blendShapeObj
  };

  return JSON.stringify(data);
}
