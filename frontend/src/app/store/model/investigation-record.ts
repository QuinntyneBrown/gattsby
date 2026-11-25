import type { Hypothesis } from './hypothesis';
import type { Investigation } from './investigation';
import type { MissingToolRequest } from './missing-tool-request';
import type { Observation } from './observation';
import type { Step } from './step';

// What the store reads back for one investigation, without its raw log.
export interface InvestigationRecord {
  readonly investigation: Investigation;
  readonly steps: readonly Step[];
  readonly observations: readonly Observation[];
  readonly hypotheses: readonly Hypothesis[];
  readonly missingToolRequests: readonly MissingToolRequest[];
}
