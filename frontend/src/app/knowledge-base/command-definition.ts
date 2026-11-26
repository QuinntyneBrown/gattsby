export interface CommandDefinition {
  readonly id: string;
  readonly protocol: 'FTMS';
  readonly service: string;
  readonly characteristic: string;
  readonly opCode: number;
  readonly claim?: string;
  readonly metric?: 'speed' | 'incline' | 'resistance' | 'power';
  readonly rangeCharacteristic?: string;
  readonly parameter?: {
    readonly type: 'uint16' | 'sint16';
    readonly scale: number;
    readonly unit: string;
  };
  readonly fixedBytes?: readonly number[];
}
