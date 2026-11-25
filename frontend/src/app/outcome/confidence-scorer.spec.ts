import { describe, expect, it } from 'vitest';
import type { Observation } from '../store/model/observation';
import { confidenceWord, scoreConfidence } from './confidence-scorer';

const FTMS = '00001826-0000-1000-8000-00805f9b34fb';
const o = (kind: string, subject: string, value = 'v'): Observation => ({
  investigationId: 'i',
  id: `o-${kind}-${subject}`,
  stepN: 1,
  kind,
  subject,
  value,
  text: kind,
  tag: 'confirmed',
  evidence: [],
});

describe('scoreConfidence (FR-053)', () => {
  it('gives nothing without a supporting observation, whatever the model proposed', () => {
    expect(scoreConfidence(FTMS, []).confidence).toBe(0);
  });

  it('gives 35 % for the protocol’s service in the layout', () => {
    expect(scoreConfidence(FTMS, [o('service', FTMS)]).confidence).toBe(0.35);
  });

  it('gives 65 % after Device Information and a profile match of 70 or more', () => {
    const result = scoreConfidence(FTMS, [
      o('service', FTMS),
      o('device-info', 'manufacturer'),
      o('profile-match', FTMS, '95'),
    ]);
    expect(result.confidence).toBe(0.65);
    expect(result.contributions.map((c) => c.rule)).toEqual([
      'serviceInLayout',
      'makerAgrees',
      'profileMatched',
    ]);
  });

  it('ignores a profile match below 70', () => {
    expect(scoreConfidence(FTMS, [o('profile-match', FTMS, '60')]).confidence).toBe(0);
  });

  it('names the confidence as a word', () => {
    expect(confidenceWord(0.35)).toBe('guess');
    expect(confidenceWord(0.65)).toBe('likely');
    expect(confidenceWord(0.9)).toBe('confirmed');
  });
});
