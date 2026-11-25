/** One field decoded from a standard notification, with its rule for the device profile. */
export interface DecodedMetric {
  readonly metric: string;
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly offset: number;
  readonly type: 'uint8' | 'uint16' | 'uint24' | 'sint16';
  readonly scale: number;
  readonly flag: number;
}
