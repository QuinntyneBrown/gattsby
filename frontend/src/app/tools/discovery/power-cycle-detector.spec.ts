import { describe, expect, it } from 'vitest';
import type { AdvertisementSample } from '../../store/model/advertisement-sample';
import { findReturningCandidate } from './power-cycle-detector';

function packets(id: string, times: number[]): AdvertisementSample[] {
  return times.map((t) => ({
    deviceId: id,
    t,
    rssi: -50,
    serviceUuids: [],
    manufacturerData: {},
    serviceData: {},
    evidenceId: `${id}-${t}`,
  }));
}

describe('Power-cycle matching (FR-013)', () => {
  const regular = packets('regular', [1_000, 2_000, 3_000, 4_000, 5_000, 6_000, 7_000, 8_000]);
  const returning = packets('returning', [1_000, 2_000, 8_000]);

  it('identifies one candidate and links both boundary packets', () => {
    const result = findReturningCandidate(
      new Map([
        ['regular', regular],
        ['returning', returning],
      ]),
      2_200,
      8_800,
    );
    expect(result).toEqual({ id: 'returning', evidence: ['returning-2000', 'returning-8000'] });
  });

  it('declines to pick when several watches have a plausible gap', () => {
    const result = findReturningCandidate(
      new Map([
        ['returning', returning],
        ['also-returning', packets('also-returning', [1_000, 2_000, 8_000])],
      ]),
      2_200,
      8_800,
    );
    expect(result).toBeNull();
  });

  it('requires a baseline and a return close to Done', () => {
    const candidates = new Map([
      ['no-baseline', packets('no-baseline', [2_000, 8_000])],
      ['late', packets('late', [1_000, 2_000, 12_000])],
      ['absent', packets('absent', [1_000, 2_000])],
    ]);
    expect(findReturningCandidate(candidates, 2_200, 8_800)).toBeNull();
  });
});
