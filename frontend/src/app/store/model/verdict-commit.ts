import type { Hypothesis } from './hypothesis';
import type { InvestigationPatch } from './investigation';
import type { MissingToolRequest } from './missing-tool-request';
import type { Observation } from './observation';
import type { RawLogEntry } from './raw-log-entry';
import type { Step } from './step';
import type { Verdict } from './verdict';

// The verdict, the final step and what it produced, written together (issue-the-verdict design). The device profile
// joins it with journey 4.
export interface VerdictCommit {
  readonly investigationId: string;
  readonly step: Step;
  readonly rawLog: readonly RawLogEntry[];
  readonly observations: readonly Observation[];
  readonly hypothesis: Hypothesis | null;
  readonly missingToolRequests: readonly MissingToolRequest[];
  readonly verdict: Verdict;
  readonly investigationPatch: InvestigationPatch;
}
