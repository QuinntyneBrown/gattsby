export interface ReconnectBannerState {
  readonly kind: 'warning' | 'success' | 'danger';
  readonly attempt: number;
  readonly recordingSeconds: number | null;
  readonly resumingDevice?: string;
}
