export interface FieldCandidate {
  readonly uuid: string;
  readonly length: number;
  readonly offset: number;
  readonly width: 1 | 2 | 4;
  readonly byteOrder: 'LE' | 'BE';
  readonly correlation: number;
  readonly accumulating: boolean;
}
