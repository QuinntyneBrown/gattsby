import type { Hypothesis } from './hypothesis';
import type { DeviceProfile } from './device-profile';
import type { InvestigationPatch } from './investigation';
import type { MissingToolRequest } from './missing-tool-request';
import type { Observation } from './observation';
import type { RawLogEntry } from './raw-log-entry';
import type { Step } from './step';
import type { Verdict } from './verdict';

// The verdict, profile and final step, written together (FR-055).
export interface VerdictCommit {
  readonly investigationId: string;
  readonly step: Step;
  readonly rawLog: readonly RawLogEntry[];
  readonly observations: readonly Observation[];
  readonly hypothesis: Hypothesis | null;
  readonly missingToolRequests: readonly MissingToolRequest[];
  readonly verdict: Verdict;
  readonly profile: DeviceProfile;
  readonly investigationPatch: InvestigationPatch;
}
