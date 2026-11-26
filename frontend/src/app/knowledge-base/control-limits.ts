export interface ControlLimits {
  readonly command: 'setTargetSpeed' | 'setTargetResistance';
  readonly direction: -1 | 1;
  readonly minValue: number;
  readonly maxValue: number;
  readonly maxStep: number;
}
