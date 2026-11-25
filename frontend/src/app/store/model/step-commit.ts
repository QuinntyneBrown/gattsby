import type { Hypothesis } from './hypothesis';
import type { InvestigationPatch } from './investigation';
import type { MissingToolRequest } from './missing-tool-request';
import type { Observation } from './observation';
import type { RawLogEntry } from './raw-log-entry';
import type { Recording } from './recording';
import type { Step } from './step';

// Everything one step produced, written in one transaction (FR-060).
export interface StepCommit {
  readonly investigationId: string;
  readonly step: Step;
  readonly rawLog: readonly RawLogEntry[];
  readonly recordings: readonly Recording[];
  readonly observations: readonly Observation[];
  readonly hypothesis: Hypothesis | null;
  readonly missingToolRequests: readonly MissingToolRequest[];
  readonly investigationPatch: InvestigationPatch;
}
