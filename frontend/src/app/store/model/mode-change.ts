import type { Stage } from './stage';

export type ChecklistFallbackReason =
  'sessionFailed' | 'twoTimeouts' | 'contextExhausted' | 'threeInvalidActions';

export interface ModeChange {
  readonly from: 'agent';
  readonly to: 'checklist';
  readonly reason: ChecklistFallbackReason;
  readonly stage: Stage;
  readonly step: number;
  readonly rejectedActionIds: readonly string[];
  readonly at: number;
}
