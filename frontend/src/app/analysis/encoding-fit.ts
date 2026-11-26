export interface EncodingFit {
  readonly type: string;
  readonly byteOrder: 'LE' | 'BE';
  readonly scale: number;
  readonly unit: string;
  readonly coverage: number;
  readonly span: number;
  readonly median: number;
  readonly width: number;
}
