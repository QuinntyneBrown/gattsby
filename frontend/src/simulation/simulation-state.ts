// What a scripted device's values are computed from. The spec sets `effort` (0 = still,
// 1 = walking or pedalling, 2 = faster); `ticks` counts notification intervals; `values` holds
// what the device was told to change, such as a target speed.
export interface SimulationState {
  effort: number;
  ticks: number;
  readonly values: Record<string, number>;
}
