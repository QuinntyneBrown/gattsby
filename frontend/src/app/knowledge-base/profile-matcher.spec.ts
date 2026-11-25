import { describe, expect, it } from 'vitest';
import { knowledgeBaseWith, realKnowledgeBase } from './knowledge-base.fixture';
import { decide, matchProfiles } from './profile-matcher';
import { canonicalUuid } from './uuid';

const kb = realKnowledgeBase();
const service = (uuid: number, chars: number[]) => ({
  uuid: canonicalUuid(uuid),
  characteristics: chars.map((c) => ({ uuid: canonicalUuid(c), properties: [] as never[] })),
});
const treadmill = [service(0x1826, [0x2acc, 0x2acd, 0x2ad9]), service(0x180d, [0x2a37])];

describe('matchProfiles (TOOL-012)', () => {
  it('puts “FTMS treadmill” first with at least 90 for 0x1826 with Treadmill Data', () => {
    const [top] = matchProfiles(kb, { layout: treadmill, name: null, deviceInfo: null });
    expect(top.label).toBe('FTMS treadmill');
    expect(top.score).toBeGreaterThanOrEqual(90);
  });

  it('gives the same output for the same input', () => {
    const facts = { layout: treadmill, name: 'HZN', deviceInfo: { manufacturer: 'X' } };
    expect(matchProfiles(kb, facts)).toEqual(matchProfiles(kb, facts));
  });

  it('decides the treadmill over the heart-rate relay it also carries', () => {
    const decision = decide(
      matchProfiles(kb, { layout: treadmill, name: null, deviceInfo: null }),
      70,
      10,
    );
    expect(decision.kind === 'decided' && decision.candidate.profileId).toBe('ftms-treadmill');
  });

  it('leaves a device with only unknown services ambiguous', () => {
    const layout = [{ uuid: 'ce060030-43e5-11e4-916c-0800200c9a66', characteristics: [] }];
    const candidates = matchProfiles(kb, { layout, name: 'PM5', deviceInfo: null }).filter(
      (c) => c.score > 0,
    );
    expect(decide(candidates, 70, 10).kind).toBe('ambiguous');
  });

  it('matches a vendor name pattern added as data, with no code change (FR-069 AC1)', () => {
    const withVendor = knowledgeBaseWith({
      vendors: [
        {
          id: 'test-vendor',
          brand: 'Testco',
          machineTypes: ['bike'],
          services: [],
          characteristics: [],
          namePatterns: [{ pattern: '^TST-', prefix: 'TST-' }],
          manufacturerIds: [],
        },
      ],
    });
    const layout = [service(0x1826, [0x2ad2, 0x2acc])];
    const plain = matchProfiles(kb, { layout, name: 'TST-1', deviceInfo: null })[0];
    const named = matchProfiles(withVendor, { layout, name: 'TST-1', deviceInfo: null })[0];
    expect(named.score).toBe(plain.score + 5);
  });
});
