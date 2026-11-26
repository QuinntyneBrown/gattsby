export interface ControlEffect {
  readonly metric: 'speed' | 'resistance';
  readonly from: number;
  readonly to: number;
  readonly baselineId: string;
}
