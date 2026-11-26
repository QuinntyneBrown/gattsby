import type { DeviceProfile } from './device-profile';
import type { Hypothesis } from './hypothesis';
import type { Investigation } from './investigation';
import type { InvestigationPhoto } from './investigation-photo';
import type { MissingToolRequest } from './missing-tool-request';
import type { ModeChange } from './mode-change';
import type { Observation } from './observation';
import type { RawLogEntry } from './raw-log-entry';
import type { Recording } from './recording';
import type { Step } from './step';

export interface InvestigationRecordDocument {
  readonly appVersion: string;
  readonly kbVersion: string;
  readonly includesNotesAndPhotos: boolean;
  readonly investigation: Omit<
    Investigation,
    | 'startedAt'
    | 'endedAt'
    | 'interruptedAt'
    | 'modeChanges'
    | 'appVersion'
    | 'kbVersion'
    | 'recordFormat'
    | 'note'
    | 'readOnly'
  > & {
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly interruptedAt: string | null;
    readonly modeChanges?: readonly (Omit<ModeChange, 'at'> & { readonly at: string })[];
  };
  readonly steps: readonly (Omit<
    Step,
    'investigationId' | 'input' | 'decidedBy' | 'ruleId' | 'startedAt' | 'endedAt'
  > & {
    readonly action: Pick<Step, 'input' | 'decidedBy' | 'ruleId'>;
    readonly startedAt: string;
    readonly endedAt: string;
  })[];
  readonly rawLog: readonly Omit<RawLogEntry, 'investigationId'>[];
  readonly observations: readonly Omit<Observation, 'investigationId'>[];
  readonly hypotheses: readonly Omit<Hypothesis, 'investigationId'>[];
  readonly recordings: readonly Omit<Recording, 'investigationId'>[];
  readonly missingToolRequests: readonly Omit<MissingToolRequest, 'investigationId'>[];
  readonly profile: DeviceProfile | null;
  readonly notes?: readonly string[];
  readonly photos?: readonly (Omit<InvestigationPhoto, 'investigationId' | 'takenAt'> & {
    readonly takenAt: string;
  })[];
}
