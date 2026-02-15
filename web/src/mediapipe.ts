/**
 * MediaPipe Manager
 * Manages MediaPipe Face Landmarker initialization and tracking
 */

import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { HeadPose } from './types';

export interface TrackingResult {
  headPose: HeadPose;
  blendShapes: Array<{ categoryName: string; score: number }>;
}

export class MediaPipeManager {
  private faceLandmarker: FaceLandmarker | null = null;
  private isTracking = false;
  private lastVideoTime = -1;
  private videoElement: HTMLVideoElement | null = null;

  // Event handlers
  public onTrackingData: ((data: TrackingResult) => void) | null = null;
  public onInitialized: (() => void) | null = null;
  public onError: ((error: Error) => void) | null = null;

  /**
   * Initialize MediaPipe Face Landmarker
   */
  async initialize(): Promise<void> {
    if (this.faceLandmarker) {
      console.log('[MediaPipe] Already initialized');
      return;
    }

    try {
      console.log('[MediaPipe] Starting initialization...');

      console.log('[MediaPipe] Loading vision tasks from CDN...');
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      console.log('[MediaPipe] Vision tasks loaded');

      console.log('[MediaPipe] Creating Face Landmarker...');
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
      console.log('[MediaPipe] Face Landmarker created successfully');

      if (this.onInitialized) {
        this.onInitialized();
      }
    } catch (error) {
      console.error('[MediaPipe] Initialization failed:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.onError) {
        this.onError(err);
      }
      throw err;
    }
  }

  /**
   * Check if MediaPipe is initialized
   */
  isInitialized(): boolean {
    return this.faceLandmarker !== null;
  }

  /**
   * Start tracking on video element
   */
  async startTracking(videoElement: HTMLVideoElement): Promise<void> {
    console.log('[MediaPipe] startTracking() called');

    // Store video element reference
    this.videoElement = videoElement;

    // Start video playback if not already playing
    if (videoElement.paused) {
      try {
        await videoElement.play();
        console.log('[MediaPipe] Video playback started');
      } catch (err) {
        console.error('[MediaPipe] Failed to start video playback:', err);
        throw new Error('Failed to start video playback: ' + err);
      }
    }

    // Initialize MediaPipe if not already initialized
    if (!this.faceLandmarker) {
      console.log('[MediaPipe] Not initialized, calling initialize()');
      await this.initialize();
    } else {
      console.log('[MediaPipe] Already initialized');
    }

    // Start tracking
    this.isTracking = true;
    this.lastVideoTime = -1;

    // Start processing video frames
    console.log('[MediaPipe] Starting video frame processing');
    this.processVideoFrame();
  }

  /**
   * Stop tracking
   */
  stopTracking(): void {
    this.isTracking = false;
    this.videoElement = null;
    console.log('[MediaPipe] Tracking stopped');
  }

  /**
   * Process video frame and extract tracking data
   */
  private processVideoFrame(): void {
    if (!this.isTracking || !this.faceLandmarker || !this.videoElement) {
      return;
    }

    // Only process if video time has changed (new frame)
    if (this.videoElement.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.videoElement.currentTime;

      try {
        const results = this.faceLandmarker.detectForVideo(
          this.videoElement,
          performance.now()
        );

        if (results.faceBlendshapes && results.faceBlendshapes.length > 0 &&
            results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
          this.processTrackingResults(results);
        }
      } catch (error) {
        console.error('[MediaPipe] Error processing frame:', error);
      }
    }

    // Continue processing
    requestAnimationFrame(() => this.processVideoFrame());
  }

  /**
   * Process MediaPipe results and emit tracking data
   */
  private processTrackingResults(results: FaceLandmarkerResult): void {
    const blendShapes = results.faceBlendshapes[0]!.categories;
    const matrix = results.facialTransformationMatrixes[0]!.data;

    // Extract position from transformation matrix (column-major format)
    // Position is in the last column: matrix[12], matrix[13], matrix[14]
    const px = matrix[12]!;
    const py = matrix[13]!;
    const pz = matrix[14]!;

    // Extract rotation (convert matrix to quaternion)
    const quaternion = this.matrixToQuaternion(matrix);

    const headPose: HeadPose = {
      px,
      py,
      pz,
      rx: quaternion.x,
      ry: quaternion.y,
      rz: quaternion.z,
      rw: quaternion.w
    };

    // Emit tracking data
    if (this.onTrackingData) {
      this.onTrackingData({
        headPose,
        blendShapes
      });
    }
  }

  /**
   * Convert 4x4 transformation matrix to quaternion
   */
  private matrixToQuaternion(m: number[]): { x: number; y: number; z: number; w: number } {
    // Extract rotation part from transformation matrix (top-left 3x3)
    const trace = m[0]! + m[5]! + m[10]!;

    let w, x, y, z;

    if (trace > 0) {
      const s = Math.sqrt(trace + 1.0) * 2;
      w = 0.25 * s;
      x = (m[6]! - m[9]!) / s;
      y = (m[8]! - m[2]!) / s;
      z = (m[1]! - m[4]!) / s;
    } else if (m[0]! > m[5]! && m[0]! > m[10]!) {
      const s = Math.sqrt(1.0 + m[0]! - m[5]! - m[10]!) * 2;
      w = (m[6]! - m[9]!) / s;
      x = 0.25 * s;
      y = (m[1]! + m[4]!) / s;
      z = (m[8]! + m[2]!) / s;
    } else if (m[5]! > m[10]!) {
      const s = Math.sqrt(1.0 + m[5]! - m[0]! - m[10]!) * 2;
      w = (m[8]! - m[2]!) / s;
      x = (m[1]! + m[4]!) / s;
      y = 0.25 * s;
      z = (m[6]! + m[9]!) / s;
    } else {
      const s = Math.sqrt(1.0 + m[10]! - m[0]! - m[5]!) * 2;
      w = (m[1]! - m[4]!) / s;
      x = (m[8]! + m[2]!) / s;
      y = (m[6]! + m[9]!) / s;
      z = 0.25 * s;
    }

    return { x, y, z, w };
  }
}
