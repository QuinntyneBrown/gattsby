import { describe, expect, it } from 'vitest';
import { assessReachability } from './reachability-assessor';

const beforeScan = {
  chosen: false,
  connected: false,
  refusedConnections: 0,
  unrecognisedScans: 0,
  checks: {},
} as const;

describe('Assess Bluetooth Low Energy reachability', () => {
  it('finds reachability when Chrome can see or connect to the device', () => {
    expect(assessReachability({ ...beforeScan, chosen: true }).reachable).toBe('yes');
    expect(
      assessReachability({ ...beforeScan, connected: true, refusedConnections: 3 }).reachable,
    ).toBe('yes');
  });

  it('requires three scans and every check before offering other transports', () => {
    const checks = { power: 'confirmed', connections: 'confirmed', range: 'confirmed' } as const;
    expect(assessReachability({ ...beforeScan, checks, unrecognisedScans: 2 }).reachable).toBe(
      'unknown',
    );
    expect(assessReachability({ ...beforeScan, checks, unrecognisedScans: 3 })).toMatchObject({
      reachable: 'no',
      likelyCauses: ['Bluetooth Classic', 'ANT+', 'Wi-Fi', 'USB'],
    });
    const uncertain = assessReachability({
      ...beforeScan,
      unrecognisedScans: 3,
      checks: { ...checks, range: 'unknown' },
    });
    expect(uncertain).toMatchObject({ reachable: 'unknown', likelyCauses: ['out of range'] });
  });

  it('distinguishes an occupied connection from an unknown transport', () => {
    expect(
      assessReachability({ ...beforeScan, chosen: true, refusedConnections: 2 }),
    ).toMatchObject({
      reachable: 'no',
      likelyCauses: ['held by another central'],
    });
    expect(
      assessReachability({
        ...beforeScan,
        checks: { connections: 'blocked' },
      }).likelyCauses,
    ).toEqual(['held by another central']);
  });
});
