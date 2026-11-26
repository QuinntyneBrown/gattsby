import { describe, expect, it } from 'vitest';
import { realKnowledgeBase } from '../knowledge-base/knowledge-base.fixture';
import { conservativeTarget } from './safety-limits';

const kb = realKnowledgeBase();
const speed = kb.command('setTargetSpeed')!;
const speedLimit = kb.safeLimits('treadmill')!;
const range = { min: 0.8, max: 16, increment: 0.1 };

describe('Conservative control (FR-036)', () => {
  it('encodes the next lower speed on the device grid', () => {
    const result = conservativeTarget(speed, speedLimit, range, 6);
    expect(result.value).toBe(5.9);
    expect([...result.bytes]).toEqual([0x02, 0x4e, 0x02]);
  });

  it.each([
    [range, 6, 8],
    [range, 9, undefined],
    [range, 0, undefined],
    [range, 6.05, undefined],
    [{ ...range, increment: 0.2 }, 6, undefined],
    [{ ...range, increment: 0 }, 6, undefined],
  ])('refuses a target outside the supported one-step policy', (offered, current, value) => {
    expect(() => conservativeTarget(speed, speedLimit, offered, current, value)).toThrow(
      expect.objectContaining({ code: 'UNSAFE_VALUE' }),
    );
  });

  it('offers just one bike resistance increment', () => {
    const result = conservativeTarget(
      kb.command('setTargetResistance')!,
      kb.safeLimits('bike')!,
      {
        min: 0,
        max: 20,
        increment: 1,
      },
      3,
    );
    expect(result.value).toBe(4);
    expect([...result.bytes]).toEqual([0x04, 0x28, 0x00]);
  });
});
