export interface VendorHandshake {
  readonly id: string;
  readonly purpose: string;
  readonly service: string;
  readonly command: string;
  readonly data: string;
  readonly bytes: readonly number[];
  readonly dataPrefix: readonly number[];
  readonly source: string;
}
