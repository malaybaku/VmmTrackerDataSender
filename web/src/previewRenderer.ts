/**
 * Preview Renderer
 * Manages preview display for different modes
 */

import { TrackingStatus, PreviewMode } from './types';
import type { HeadPose, EulerAngles } from './types';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { formatFixedWidth } from './utils/math';

export class PreviewRenderer {
  private canvas: HTMLCanvasElement;
  private overlay: HTMLDivElement;
  private video: HTMLVideoElement;
  private ctx: CanvasRenderingContext2D;
  private currentMode: PreviewMode = PreviewMode.Landmarks;

  constructor(
    canvas: HTMLCanvasElement,
    overlay: HTMLDivElement,
    video: HTMLVideoElement
  ) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.video = video;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;

    // Set initial mode to configure display states
    this.setMode(this.currentMode);
  }

  /**
   * Set preview mode
   */
  setMode(mode: PreviewMode): void {
    this.currentMode = mode;

    // Show/hide video and canvas based on mode
    if (mode === PreviewMode.Camera) {
      this.video.style.display = 'block';
      this.canvas.style.display = 'block';
      this.canvas.classList.add('canvas-overlay');
      this.overlay.style.display = 'block';
    } else {
      this.video.style.display = 'none';
      this.canvas.style.display = 'block';
      this.canvas.classList.remove('canvas-overlay');
      this.overlay.style.display = 'block';
    }
  }

  /**
   * Get current preview mode
   */
  getMode(): PreviewMode {
    return this.currentMode;
  }

  /**
   * Render based on current mode
   */
  render(
    status: TrackingStatus,
    headPose: HeadPose | null,
    euler: EulerAngles | null,
    landmarks: NormalizedLandmark[] | null
  ): void {
    switch (this.currentMode) {
      case PreviewMode.DataOnly:
        this.renderDataOnly(status, headPose, euler);
        break;
      case PreviewMode.Landmarks:
        this.renderLandmarks(status, headPose, euler, landmarks);
        break;
      case PreviewMode.Camera:
        this.renderCamera(status, headPose, euler, landmarks);
        break;
    }
  }

  /**
   * Mode B: Status + numerical data
   */
  private renderDataOnly(
    status: TrackingStatus,
    headPose: HeadPose | null,
    euler: EulerAngles | null
  ): void {
    // Clear canvas with dark background (slightly lighter than pure black)
    this.ctx.fillStyle = '#0f0f0f';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Update overlay with status and data (same style as mode C)
    const { icon, text, color } = this.getStatusInfo(status);

    // Always show data section, use "-" if no tracking data
    const dataHtml = this.formatDataHtml(headPose, euler, status);

    this.overlay.innerHTML = `
      <div style="
        position: absolute;
        top: 1rem;
        left: 1rem;
        background: rgba(40, 40, 40, 0.85);
        padding: 1rem;
        border-radius: 8px;
        color: ${color};
        max-width: 400px;
      ">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.5rem;">${icon}</span>
          <span style="font-weight: 600;">${text}</span>
        </div>
        ${dataHtml}
      </div>
    `;
  }

  /**
   * Mode C: Status + numerical data + landmarks
   */
  private renderLandmarks(
    status: TrackingStatus,
    headPose: HeadPose | null,
    euler: EulerAngles | null,
    landmarks: NormalizedLandmark[] | null
  ): void {
    // Resize canvas to match video dimensions
    if (this.video.videoWidth > 0 && this.video.videoHeight > 0) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }

    // Clear canvas with dark background (slightly lighter than pure black, do NOT draw video)
    this.ctx.fillStyle = '#0f0f0f';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw landmarks if available
    if (landmarks && status === 'tracking-success') {
      this.drawLandmarks(landmarks);
    }

    // Update overlay with status and data (semi-transparent background)
    const { icon, text, color } = this.getStatusInfo(status);

    // Always show data section, use "-" if no tracking data
    const dataHtml = this.formatDataHtml(headPose, euler, status);

    this.overlay.innerHTML = `
      <div style="
        position: absolute;
        top: 1rem;
        left: 1rem;
        background: rgba(40, 40, 40, 0.85);
        padding: 1rem;
        border-radius: 8px;
        color: ${color};
        max-width: 400px;
      ">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.5rem;">${icon}</span>
          <span style="font-weight: 600;">${text}</span>
        </div>
        ${dataHtml}
      </div>
    `;
  }

  /**
   * Mode D: Video raw with status and data overlay
   */
  private renderCamera(
    status: TrackingStatus,
    headPose: HeadPose | null,
    euler: EulerAngles | null,
    landmarks: NormalizedLandmark[] | null
  ): void {
    // Resize canvas to match video dimensions for landmark overlay
    if (this.video.videoWidth > 0 && this.video.videoHeight > 0) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }

    // Clear canvas with transparent background (video shows through)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw landmarks overlay if available
    if (landmarks && status === 'tracking-success') {
      this.drawLandmarks(landmarks);
    }

    // Video element is displayed directly, just update overlay with status and data
    const { icon, text, color } = this.getStatusInfo(status);

    // Always show data section, use "-" if no tracking data
    const dataHtml = this.formatDataHtml(headPose, euler, status);

    this.overlay.innerHTML = `
      <div style="
        position: absolute;
        top: 1rem;
        left: 1rem;
        background: rgba(40, 40, 40, 0.85);
        padding: 1rem;
        border-radius: 8px;
        color: ${color};
        max-width: 400px;
      ">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.5rem;">${icon}</span>
          <span style="font-weight: 600;">${text}</span>
        </div>
        ${dataHtml}
      </div>
    `;
  }

  /**
   * Draw 468 face landmarks on canvas
   */
  private drawLandmarks(landmarks: NormalizedLandmark[]): void {
    this.ctx.fillStyle = '#00ff00';

    for (const landmark of landmarks) {
      // Convert normalized coordinates to canvas coordinates
      // Mirror X coordinate (subtract from 1 because video is mirrored)
      const x = (1 - landmark.x) * this.canvas.width;
      const y = landmark.y * this.canvas.height;

      // Draw small circle for each landmark
      this.ctx.beginPath();
      this.ctx.arc(x, y, 1, 0, 2 * Math.PI);
      this.ctx.fill();
    }
  }

  /**
   * Format data HTML for position and rotation
   * Shows "-" when tracking is not successful
   */
  private formatDataHtml(
    headPose: HeadPose | null,
    euler: EulerAngles | null,
    status: TrackingStatus
  ): string {
    if (headPose && euler && status === TrackingStatus.TrackingSuccess) {
      return `
        <div style="margin-top: 1rem; font-size: 0.875rem; font-family: 'Courier New', monospace;">
          <div style="margin-bottom: 0.5rem;">
            <strong>位置 (cm):</strong>
            X: ${formatFixedWidth(headPose.px)},
            Y: ${formatFixedWidth(headPose.py)},
            Z: ${formatFixedWidth(headPose.pz)}
          </div>
          <div>
            <strong>姿勢(deg):</strong>
            x: ${formatFixedWidth(euler.pitch)},
            y: ${formatFixedWidth(euler.yaw)},
            z: ${formatFixedWidth(euler.roll)}
          </div>
        </div>
      `;
    } else {
      return `
        <div style="margin-top: 1rem; font-size: 0.875rem; font-family: 'Courier New', monospace;">
          <div style="margin-bottom: 0.5rem;">
            <strong>位置 (cm):</strong>
            X: -,
            Y: -,
            Z: -
          </div>
          <div>
            <strong>姿勢(deg):</strong>
            x: -,
            y: -,
            z: -
          </div>
        </div>
      `;
    }
  }

  /**
   * Get status information (icon, text, color)
   */
  private getStatusInfo(status: TrackingStatus): { icon: string; text: string; color: string } {
    switch (status) {
      case TrackingStatus.TrackingSuccess:
        return { icon: '✅', text: 'トラッキング成功', color: '#28a745' };
      case TrackingStatus.TrackingNoFace:
        return { icon: '⚠️', text: '処理中・顔未検出', color: '#ffc107' };
      case TrackingStatus.NotTracking:
        return { icon: '❌', text: 'トラッキング未実行', color: '#6c757d' };
      default:
        return { icon: '❌', text: 'トラッキング未実行', color: '#6c757d' };
    }
  }
}
