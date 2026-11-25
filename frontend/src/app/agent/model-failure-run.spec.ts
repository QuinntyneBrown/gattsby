import { describe, expect, it } from 'vitest';
import { ModelFailureRun } from './model-failure-run';

describe('Model fallback triggers (FR-006)', () => {
  it('counts consecutive timeouts and resets after another result', () => {
    const run = new ModelFailureRun();
    expect(run.report('s-1', 'TIMEOUT')).toBeNull();
    expect(run.report('s-2', null)).toBeNull();
    expect(run.report('s-3', 'TIMEOUT')).toBeNull();
    expect(run.report('s-4', 'TIMEOUT')).toEqual({ reason: 'twoTimeouts', rejectedActionIds: [] });
  });

  it('keeps only the three consecutive rejected action IDs', () => {
    const run = new ModelFailureRun();
    expect(run.report('s-1', 'INVALID_INPUT')).toBeNull();
    expect(run.report('s-2', 'TIMEOUT')).toBeNull();
    expect(run.report('s-3', 'UNKNOWN_TOOL')).toBeNull();
    expect(run.report('s-4', 'PRECONDITION_FAILED')).toBeNull();
    expect(run.report('s-5', 'INVALID_INPUT')).toEqual({
      reason: 'threeInvalidActions',
      rejectedActionIds: ['s-3', 's-4', 's-5'],
    });
  });

  it('falls back as soon as the context is exhausted or the session stops', () => {
    expect(new ModelFailureRun().report('s-1', 'CONTEXT_EXHAUSTED')).toMatchObject({
      reason: 'contextExhausted',
    });
    expect(new ModelFailureRun().report('s-1', 'MODEL_SESSION_FAILED')).toMatchObject({
      reason: 'sessionFailed',
    });
  });
});
