import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOP_CONFIG } from './loop-config';
import { checkStop } from './stop-conditions';

describe('checkStop (FR-045)', () => {
  it('carries on below every limit', () => {
    expect(checkStop({ steps: 10, noProgressRun: 2 }, 0.65, false, DEFAULT_LOOP_CONFIG)).toBeNull();
  });

  it('stops when 40 steps have run', () => {
    expect(checkStop({ steps: 40, noProgressRun: 0 }, 0, false, DEFAULT_LOOP_CONFIG)).toBe(
      'stepBudget',
    );
  });

  it('stops after five steps that added no observation', () => {
    expect(checkStop({ steps: 12, noProgressRun: 5 }, 0, false, DEFAULT_LOOP_CONFIG)).toBe(
      'noProgress',
    );
  });

  it('stops at the finish confidence only once the checks are done', () => {
    expect(checkStop({ steps: 9, noProgressRun: 0 }, 0.9, false, DEFAULT_LOOP_CONFIG)).toBeNull();
    expect(checkStop({ steps: 9, noProgressRun: 0 }, 0.9, true, DEFAULT_LOOP_CONFIG)).toBe(
      'confidenceReached',
    );
  });

  it('prefers the confidence over the budget when both hold', () => {
    expect(checkStop({ steps: 40, noProgressRun: 5 }, 0.95, true, DEFAULT_LOOP_CONFIG)).toBe(
      'confidenceReached',
    );
  });
});
