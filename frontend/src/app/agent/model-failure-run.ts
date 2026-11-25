import type { ChecklistFallbackReason } from '../store/model/mode-change';
import type { ErrorCode } from '../tools/error-code';

export class ModelFailureRun {
  private timeouts = 0;
  private rejected: string[] = [];

  report(
    stepId: string,
    error: ErrorCode | null,
  ): {
    reason: ChecklistFallbackReason;
    rejectedActionIds: readonly string[];
  } | null {
    if (error === 'MODEL_SESSION_FAILED') return { reason: 'sessionFailed', rejectedActionIds: [] };
    if (error === 'CONTEXT_EXHAUSTED') return { reason: 'contextExhausted', rejectedActionIds: [] };
    if (error === 'TIMEOUT') {
      this.rejected = [];
      return ++this.timeouts === 2 ? { reason: 'twoTimeouts', rejectedActionIds: [] } : null;
    }
    this.timeouts = 0;
    if (!error || error === 'ABORTED') {
      this.rejected = [];
      return null;
    }
    this.rejected.push(stepId);
    return this.rejected.length === 3
      ? { reason: 'threeInvalidActions', rejectedActionIds: [...this.rejected] }
      : null;
  }
}
