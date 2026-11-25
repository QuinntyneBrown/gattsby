import { describe, expect, it } from 'vitest';
import { realKnowledgeBase } from '../knowledge-base/knowledge-base.fixture';
import type { VerdictFacts } from '../outcome/verdict-builder';
import type { DecisionState } from './decision-state';
import { INITIAL_STATE } from './decision-state';
import { DEFAULT_LOOP_CONFIG } from './loop-config';
import { nextOutcome } from './playbook-rules';
import type { ProfileCandidate } from './profile-candidate';

const kb = realKnowledgeBase();
const FTMS = '00001826-0000-1000-8000-00805f9b34fb';
const DIS = '0000180a-0000-1000-8000-00805f9b34fb';
const facts: VerdictFacts = {
  hypothesis: null,
  observations: [],
  missingToolRequests: [],
  everConnected: false,
  stopReason: 'finish',
  protocolKnown: false,
};

function next(state: Partial<DecisionState>, concludeNow = false) {
  return nextOutcome(
    { state: { ...INITIAL_STATE, ...state }, kb, config: DEFAULT_LOOP_CONFIG, facts },
    concludeNow,
  );
}

function tool(state: Partial<DecisionState>): string | undefined {
  const outcome = next(state);
  return outcome?.kind === 'decided' ? outcome.action.tool : outcome?.kind;
}

const prepared: Partial<DecisionState> = {
  capabilitiesChecked: true,
  machineType: 'treadmill',
  brand: null,
  poweredOn: true,
};

const treadmill: ProfileCandidate = {
  profileId: 'ftms-treadmill',
  label: 'FTMS treadmill',
  protocol: 'FTMS',
  serviceUuid: FTMS,
  deviceType: 'treadmill',
  score: 95,
  matched: [],
  missing: [],
};

describe('PlaybookRules (FR-046)', () => {
  it('checks capabilities first', () => {
    expect(tool({})).toBe('check_capabilities');
  });

  it('asks the machine type with six answers before the brand', () => {
    const outcome = next({ capabilitiesChecked: true });
    expect(outcome?.kind === 'decided' && outcome.action.input['answers']).toEqual([
      'Treadmill',
      'Bike',
      'Rower',
      'Cross-trainer',
      'Heart-rate sensor',
      'Other',
    ]);
  });

  it('asks the brand with at most five suggestions for the machine type and free text', () => {
    const outcome = next({ capabilitiesChecked: true, machineType: 'treadmill' });
    expect(outcome?.kind).toBe('decided');
    if (outcome?.kind !== 'decided') return;
    expect(outcome.action.ruleId).toBe('prepare.brand');
    expect((outcome.action.input['answers'] as string[]).length).toBeLessThanOrEqual(5);
    expect(outcome.action.input['allowFreeText']).toBe(true);
  });

  it('carries on to Find when both answers were “Don’t know” (FR-008 AC3)', () => {
    expect(tool({ ...prepared, machineType: null })).toBe('scan_devices');
  });

  it('widens to every device after a cancelled filtered scan (FR-012)', () => {
    expect(tool({ ...prepared, scans: [{ mode: 'filtered', outcome: 'cancelled' }] })).toBe(
      'scan_all_devices',
    );
  });

  it('connects once a device is chosen', () => {
    expect(
      tool({
        ...prepared,
        scans: [{ mode: 'filtered', outcome: 'chosen' }],
        device: { deviceId: 'd', name: 'T', advertisedServices: [] },
      }),
    ).toBe('connect');
  });

  it('asks to disconnect other apps after a refused connection, then reconnects (FR-017)', () => {
    const chosen: Partial<DecisionState> = {
      ...prepared,
      scans: [{ mode: 'filtered', outcome: 'chosen' }],
      device: { deviceId: 'd', name: 'T', advertisedServices: [] },
      connectAttempts: 1,
      connectFailures: 1,
    };
    expect(tool(chosen)).toBe('request_action');
    expect(tool({ ...chosen, heldPrompts: 1 })).toBe('connect');
  });

  it('lists the layout, reads Device Information, then matches the profiles', () => {
    const connected: Partial<DecisionState> = {
      ...prepared,
      device: { deviceId: 'd', name: 'T', advertisedServices: [] },
      connectAttempts: 1,
      connected: true,
      everConnected: true,
    };
    expect(tool(connected)).toBe('enumerate_gatt');
    const layout = [
      { uuid: FTMS, characteristics: [] },
      { uuid: DIS, characteristics: [] },
    ];
    expect(tool({ ...connected, layout })).toBe('read_device_info');
    expect(tool({ ...connected, layout, deviceInfo: { manufacturer: 'Acme' } })).toBe(
      'match_known_profiles',
    );
  });

  it('records Device Information’s absence by moving on to the match (FR-020 AC2)', () => {
    expect(
      tool({
        ...prepared,
        device: { deviceId: 'd', name: 'T', advertisedServices: [] },
        connectAttempts: 1,
        connected: true,
        layout: [{ uuid: FTMS, characteristics: [] }],
      }),
    ).toBe('match_known_profiles');
  });

  it('reads the decided protocol’s readable characteristics before offering to record live data (FR-021, FR-024)', () => {
    const matched: Partial<DecisionState> = {
      ...prepared,
      device: { deviceId: 'd', name: 'T', advertisedServices: [] },
      connectAttempts: 1,
      connected: true,
      layout: [
        {
          uuid: FTMS,
          characteristics: [
            { uuid: '00002acc-0000-1000-8000-00805f9b34fb', properties: ['read'] },
            { uuid: '00002acd-0000-1000-8000-00805f9b34fb', properties: ['notify'] },
          ],
        },
      ],
      deviceInfo: 'absent',
      candidates: [treadmill],
    };
    const outcome = next(matched);
    expect(outcome?.kind === 'decided' && outcome.action.input).toEqual({
      service: FTMS,
      characteristic: '00002acc-0000-1000-8000-00805f9b34fb',
    });
    const identified = { ...matched, reads: ['00002acc-0000-1000-8000-00805f9b34fb'] };
    expect(tool(identified)).toBe('request_action');
    expect(tool({ ...identified, standardRecording: 'skipped' })).toBe('finish');
  });

  it('hands two protocols within 10 points to the decider', () => {
    const rival = { ...treadmill, profileId: 'heart-rate-sensor', serviceUuid: 'hr', score: 90 };
    expect(
      tool({
        ...prepared,
        device: { deviceId: 'd', name: 'T', advertisedServices: [] },
        connectAttempts: 1,
        connected: true,
        layout: [{ uuid: FTMS, characteristics: [] }],
        deviceInfo: 'absent',
        candidates: [treadmill, rival],
      }),
    ).toBe('ambiguous');
  });

  it('concludes at once when asked to, whatever the stage', () => {
    expect(tool({ stage: 'prepare' }) === 'check_capabilities' && next({}, true)?.kind).toBe(
      'decided',
    );
    const outcome = next({}, true);
    expect(outcome?.kind === 'decided' && outcome.action.tool).toBe('finish');
  });
});
