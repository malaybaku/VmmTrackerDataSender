/**
 * UI Manager
 * Manages UI state and updates
 */

import { VideoSourceState, type StatusType } from './types';

export class UIManager {
  private readonly statusSpan: HTMLSpanElement;
  private readonly connectBtn: HTMLButtonElement;
  private readonly startCameraBtn: HTMLButtonElement;
  private readonly startVideoBtn: HTMLButtonElement;
  private readonly restartVideoBtn: HTMLButtonElement;
  private readonly stopTrackingBtn: HTMLButtonElement;

  constructor(
    statusSpan: HTMLSpanElement,
    connectBtn: HTMLButtonElement,
    startCameraBtn: HTMLButtonElement,
    startVideoBtn: HTMLButtonElement,
    restartVideoBtn: HTMLButtonElement,
    stopTrackingBtn: HTMLButtonElement
  ) {
    this.statusSpan = statusSpan;
    this.connectBtn = connectBtn;
    this.startCameraBtn = startCameraBtn;
    this.startVideoBtn = startVideoBtn;
    this.restartVideoBtn = restartVideoBtn;
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
        this.startVideoBtn.disabled = false;
        this.restartVideoBtn.disabled = true;
        this.stopTrackingBtn.disabled = true;
        break;

      case VideoSourceState.Busy:
        // Disable all buttons during processing
        this.startCameraBtn.disabled = true;
        this.startVideoBtn.disabled = true;
        this.restartVideoBtn.disabled = true;
        this.stopTrackingBtn.disabled = true;
        break;

      case VideoSourceState.CameraRunning:
        this.startCameraBtn.disabled = true;
        this.startVideoBtn.disabled = true;
        this.restartVideoBtn.disabled = true;
        this.stopTrackingBtn.disabled = false;
        break;

      case VideoSourceState.VideoRunning:
        this.startCameraBtn.disabled = true;
        this.startVideoBtn.disabled = true;
        this.restartVideoBtn.disabled = true;
        this.stopTrackingBtn.disabled = false;
        break;

      case VideoSourceState.VideoStopped:
        this.startCameraBtn.disabled = false;
        this.startVideoBtn.disabled = false;
        this.restartVideoBtn.disabled = false;
        this.stopTrackingBtn.disabled = true;
        break;
    }

    console.log(`[UI] Button states updated for: ${state}`);
  }

  /**
   * Set connect button text
   */
  setConnectButtonText(text: string): void {
    this.connectBtn.textContent = text;
  }
}
