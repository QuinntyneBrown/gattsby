// The device the person picked in Chrome's chooser (scan-for-the-device design).
export interface ChosenDevice {
  readonly deviceId: string;
  /** `null` when the device has no name; shown as "Unnamed device". */
  readonly name: string | null;
  readonly advertisedServices: readonly string[];
}
