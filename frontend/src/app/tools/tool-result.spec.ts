import { describe, expect, it } from 'vitest';
import { fail, normaliseSummary, ok } from './tool-result';

describe('the result envelope (FR-072)', () => {
  it('puts a summary on one line', () => {
    expect(normaliseSummary('Connected.\n4 services.')).toBe('Connected. 4 services.');
  });

  it('cuts a summary longer than 200 characters to 199 and an ellipsis', () => {
    const summary = normaliseSummary('a'.repeat(250));
    expect(summary).toHaveLength(200);
    expect(summary.endsWith('…')).toBe(true);
  });

  it('carries data and no error when ok', () => {
    expect(ok('Done.', { n: 1 }, ['o-1'])).toEqual({
      ok: true,
      summary: 'Done.',
      data: { n: 1 },
      error: null,
      evidence: ['o-1'],
    });
  });

  it('carries a shared code and no data when not ok', () => {
    expect(fail('TIMEOUT', 'Too long.')).toEqual({
      ok: false,
      summary: 'Too long.',
      data: null,
      error: { code: 'TIMEOUT', message: 'Too long.' },
      evidence: [],
    });
  });
});
