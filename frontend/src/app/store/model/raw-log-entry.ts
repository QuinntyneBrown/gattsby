import type { DecodedMetric } from '../../knowledge-base/decoders/decoded-metric';

export type RawLogKind =
  | 'scan'
  | 'advertisement'
  | 'connect'
  | 'disconnect'
  | 'read'
  | 'write'
  | 'notification'
  | 'indication';

// One Bluetooth event in the raw traffic log (FR-073; log-raw-traffic design).
export interface RawLogEntry {
  readonly investigationId: string;
  /** Evidence ID, `r-` and the sequence number. */
  readonly id: string;
  readonly seq: number;
  readonly stepN: number;
  readonly t: number;
  readonly kind: RawLogKind;
  readonly service?: string;
  readonly uuid?: string;
  readonly direction: 'in' | 'out';
  readonly hex: string;
  readonly approvalId?: string;
  readonly source?: string;
  readonly detail?: string;
  readonly decoded?: readonly DecodedMetric[];
  readonly decodeError?: string;
  readonly recordingId?: string;
}
