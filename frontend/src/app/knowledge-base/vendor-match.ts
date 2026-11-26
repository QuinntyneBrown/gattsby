export interface VendorMatch {
  readonly vendor: string;
  readonly matchedOn: readonly ('name' | 'uuid' | 'manufacturerId')[];
  readonly score: number;
  readonly hasDecoder: boolean;
  readonly hasHandshake: boolean;
  readonly source: string;
}
