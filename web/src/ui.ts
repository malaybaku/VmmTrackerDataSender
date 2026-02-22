/**
 * UI Manager
 * Manages UI state and updates
 */

import { VideoSourceState, type StatusType } from './types';

export class UIManager {
  private readonly statusSpan: HTMLSpanElement;
  private readonly startCameraBtn: HTMLButtonElement;
  private readonly stopTrackingBtn: HTMLButtonElement;

  constructor(
    statusSpan: HTMLSpanElement,
    startCameraBtn: HTMLButtonElement,
    stopTrackingBtn: HTMLButtonElement
  ) {
    this.statusSpan = statusSpan;
    this.startCameraBtn = startCameraBtn;
    this.stopTrackingBtn = stopTrackingBtn;
  }

  /**
   * Update status message
   */
  updateStatus(message: string, type: StatusType = 'normal'): void {
    this.statusSpan.textContent = message;
    this.statusSpan.className = 'status';
    if (type === 'connected') this.statusSpan.classList.add('connected');
    if (type === 'error') this.statusSpan.classList.add('error');
  }

  /**
   * Update button states based on video source state
   */
  updateButtonStates(state: VideoSourceState): void {
    switch (state) {
      case VideoSourceState.None:
        this.startCameraBtn.disabled = false;
        this.stopTrackingBtn.disabled = true;
        break;

      case VideoSourceState.Busy:
        this.startCameraBtn.disabled = true;
        this.stopTrackingBtn.disabled = true;
        break;

      case VideoSourceState.CameraRunning:
        this.startCameraBtn.disabled = true;
        this.stopTrackingBtn.disabled = false;
        break;

      case VideoSourceState.VideoRunning:
        this.startCameraBtn.disabled = true;
        this.stopTrackingBtn.disabled = false;
        break;

      case VideoSourceState.VideoStopped:
        this.startCameraBtn.disabled = false;
        this.stopTrackingBtn.disabled = true;
        break;
    }

    console.log(`[UI] Button states updated for: ${state}`);
  }
}
