export interface BluetoothAdvertisingEvent extends Event {
  readonly device: BluetoothDevice;
  readonly uuids: readonly string[];
  readonly rssi: number | null;
  readonly txPower: number | null;
  readonly manufacturerData: ReadonlyMap<number, DataView>;
  readonly serviceData: ReadonlyMap<string, DataView>;
}
