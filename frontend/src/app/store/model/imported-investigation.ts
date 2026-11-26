import type { DeviceProfile } from './device-profile';
import type { InvestigationPhoto } from './investigation-photo';
import type { InvestigationRecord } from './investigation-record';
import type { RawLogEntry } from './raw-log-entry';
import type { Recording } from './recording';

export interface ImportedInvestigation extends InvestigationRecord {
  readonly rawLog: readonly RawLogEntry[];
  readonly recordings: readonly Recording[];
  readonly photos: readonly InvestigationPhoto[];
  readonly profile: DeviceProfile | null;
  readonly includesNotesAndPhotos: boolean;
}
