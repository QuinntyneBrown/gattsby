import type { StopReason } from '../store/model/stop-reason';
import type { LoopConfig } from './loop-config';

// What the stop conditions count (end-the-loop design).
export interface LoopProgress {
  readonly steps: number;
  readonly noProgressRun: number;
}

/** The stop reason after a step, or null to carry on (FR-045). Pure. */
export function checkStop(
  progress: LoopProgress,
  confidence: number,
  checksDone: boolean,
  config: LoopConfig,
): StopReason | null {
  if (confidence >= config.finishConfidence && checksDone) return 'confidenceReached';
  if (progress.steps >= config.stepBudget) return 'stepBudget';
  if (progress.noProgressRun >= config.noProgressSteps) return 'noProgress';
  return null;
}
