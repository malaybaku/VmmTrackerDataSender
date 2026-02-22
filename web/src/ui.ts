/**
 * UI Manager
 * Manages UI state and updates
 */

import type { StatusType } from './types';

export class UIManager {
  private readonly statusSpan: HTMLSpanElement;

  constructor(statusSpan: HTMLSpanElement) {
    this.statusSpan = statusSpan;
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
}
