import type { MissingToolRequest } from './missing-tool-request';

export interface MissingToolListEntry {
  readonly request: MissingToolRequest;
  readonly deviceName: string;
  readonly hasVerdict: boolean;
}
