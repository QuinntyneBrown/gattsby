// What Web Bluetooth offers here (check-capabilities design).
export interface BleAvailability {
  readonly api: boolean;
  readonly adapterAvailable: boolean;
  readonly blocked: boolean;
  readonly watchAdvertisements: boolean;
  readonly requestLEScan: boolean;
  readonly getDevices: boolean;
}
