export interface FramingReport {
  readonly header?: { readonly offset: 0; readonly bytes: string; readonly share: number };
  readonly length?: {
    readonly offset: number;
    readonly includesHeader: boolean;
    readonly relation: 'total' | 'afterHeader' | 'afterLength';
    readonly share: number;
    readonly ambiguous: boolean;
  };
  readonly counter?: { readonly offset: number; readonly step: number; readonly share: number };
  readonly checksum?: {
    readonly offset: -1 | -2;
    readonly algorithm: 'sum8' | 'xor8' | 'crc8' | 'crc16-ccitt' | 'crc16-modbus';
    readonly range: readonly [number, number];
    readonly byteOrder?: 'LE' | 'BE';
    readonly share: number;
  };
  readonly fit: number;
  readonly packets: number;
}
