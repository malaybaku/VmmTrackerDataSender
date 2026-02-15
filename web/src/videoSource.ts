/**
 * Video Source Manager
 * Manages video input sources (camera and video files)
 */

import { VideoSourceState } from './types';

export class VideoSourceManager {
  private state: VideoSourceState = VideoSourceState.None;
  private mediaStream: MediaStream | null = null;
  private currentVideoFile: File | null = null;
  private currentVideoUrl: string | null = null;

  // Event handlers
  public onStateChange: ((newState: VideoSourceState) => void) | null = null;

  constructor(private readonly videoElement: HTMLVideoElement) {}

  /**
   * Get current state
   */
  getState(): VideoSourceState {
    return this.state;
  }

  /**
   * Set state and notify listeners
   */
  private setState(newState: VideoSourceState): void {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
    console.log(`[VideoSource] State changed to: ${newState}`);
  }

  /**
   * Start camera
   */
  async startCamera(): Promise<void> {
    // Clear previous sources
    this.stop();

    // Start camera
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      }
    });

    this.videoElement.srcObject = this.mediaStream;
    await this.videoElement.play();
    console.log('[VideoSource] Camera started');

    this.setState(VideoSourceState.CameraRunning);
  }

  /**
   * Start video file
   */
  async startVideoFile(file: File): Promise<void> {
    // Clear previous sources
    this.stop();

    // Load video file
    this.currentVideoFile = file;
    this.currentVideoUrl = null;
    this.videoElement.src = URL.createObjectURL(file);
    this.videoElement.loop = true;
    await this.videoElement.play();
    console.log('[VideoSource] Video file loaded and playing');

    this.setState(VideoSourceState.VideoRunning);
  }

  /**
   * Start video from URL (for debug mode)
   */
  async startVideoUrl(url: string): Promise<void> {
    // Clear previous sources
    this.stop();

    // Load video URL
    this.currentVideoFile = null;
    this.currentVideoUrl = url;
    this.videoElement.src = url;
    this.videoElement.loop = true;
    // Don't auto-play (autoplay policy)
    console.log('[VideoSource] Video URL loaded (not playing)');

    this.setState(VideoSourceState.VideoStopped);
  }

  /**
   * Restart video (replay the same file or URL)
   */
  async restartVideo(): Promise<void> {
    if (!this.currentVideoFile && !this.currentVideoUrl) {
      throw new Error('No video file or URL to restart');
    }

    if (this.currentVideoFile) {
      this.videoElement.src = URL.createObjectURL(this.currentVideoFile);
      console.log('[VideoSource] Reloading video file');
    } else if (this.currentVideoUrl) {
      this.videoElement.src = this.currentVideoUrl;
      console.log('[VideoSource] Reloading video URL:', this.currentVideoUrl);
    }

    this.videoElement.loop = true;
    await this.videoElement.play();
    console.log('[VideoSource] Video playing');

    this.setState(VideoSourceState.VideoRunning);
  }

  /**
   * Stop video source completely
   */
  stop(): void {
    // Stop camera stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Clear video element
    this.videoElement.srcObject = null;
    this.videoElement.src = '';
    this.videoElement.pause();

    // Keep currentVideoFile and currentVideoUrl for restart functionality
    // Only clear state
    this.setState(VideoSourceState.None);
  }

  /**
   * Pause video (for video files only)
   */
  pause(): void {
    if (this.state === VideoSourceState.CameraRunning) {
      // Can't pause camera, stop it instead
      this.stop();
    } else if (this.state === VideoSourceState.VideoRunning) {
      this.videoElement.pause();
      this.setState(VideoSourceState.VideoStopped);
    }
  }

  /**
   * Clear video file/URL references (for complete cleanup)
   */
  clearVideoReferences(): void {
    this.currentVideoFile = null;
    this.currentVideoUrl = null;
  }
}
