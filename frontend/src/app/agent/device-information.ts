// What the Device Information Service told us (TOOL-010), strings as text and IDs as hex.
export interface DeviceInformation {
  readonly manufacturer?: string;
  readonly model?: string;
  readonly serial?: string;
  readonly hardware?: string;
  readonly firmware?: string;
  readonly software?: string;
  readonly systemId?: string;
  readonly pnpId?: string;
}
