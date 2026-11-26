import type { RawLogEntry } from '../../store/model/raw-log-entry';

export interface EvidenceRow {
  readonly id: string;
  readonly at: number;
  readonly author: 'Sent' | 'Received' | 'You' | 'Agent';
  readonly text?: string;
  readonly packet?: RawLogEntry;
  readonly evidence?: readonly string[];
}
