export interface AdvertisementSample {
  readonly deviceId: string;
  readonly t: number;
  readonly rssi: number | null;
  readonly txPower?: number;
  readonly serviceUuids: readonly string[];
  readonly manufacturerData: Readonly<Record<string, string>>;
  readonly serviceData: Readonly<Record<string, string>>;
  readonly evidenceId: string;
}
