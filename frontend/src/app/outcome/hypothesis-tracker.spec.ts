import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, type DecisionState } from '../agent/decision-state';
import { DEFAULT_LOOP_CONFIG } from '../agent/loop-config';
import { realKnowledgeBase } from '../knowledge-base/knowledge-base.fixture';
import type { Observation } from '../store/model/observation';
import { HypothesisTracker } from './hypothesis-tracker';

const kb = realKnowledgeBase();
const FTMS = '00001826-0000-1000-8000-00805f9b34fb';
const service: Observation = {
  investigationId: 'i',
  id: 'o-1',
  stepN: 5,
  kind: 'service',
  subject: FTMS,
  value: '0x1826',
  text: 'Fitness Machine (0x1826)',
  tag: 'confirmed',
  evidence: [],
};
const layout: Partial<DecisionState> = { layout: [{ uuid: FTMS, characteristics: [] }] };

describe('HypothesisTracker (FR-053)', () => {
  it('forms “Standard fitness machine (FTMS)” at 35 % from the layout', () => {
    const tracker = new HypothesisTracker('i');
    const version = tracker.rescore(
      5,
      { ...INITIAL_STATE, ...layout },
      [service],
      kb,
      DEFAULT_LOOP_CONFIG,
      1,
    );
    expect(version).toMatchObject({
      version: 1,
      id: 'h-1',
      stepN: 5,
      source: 'rules',
      label: 'Standard fitness machine (FTMS)',
      protocol: 'FTMS',
      confidence: 0.35,
      evidence: ['o-1'],
    });
  });

  it('adds no version when nothing changed', () => {
    const tracker = new HypothesisTracker('i');
    const state = { ...INITIAL_STATE, ...layout };
    tracker.rescore(5, state, [service], kb, DEFAULT_LOOP_CONFIG, 1);
    expect(tracker.rescore(6, state, [service], kb, DEFAULT_LOOP_CONFIG, 2)).toBeNull();
    expect(tracker.all()).toHaveLength(1);
  });

  it('keeps every version and links each to the one it replaces', () => {
    const tracker = new HypothesisTracker('i');
    tracker.rescore(5, { ...INITIAL_STATE, ...layout }, [service], kb, DEFAULT_LOOP_CONFIG, 1);
    const second = tracker.rescore(
      6,
      { ...INITIAL_STATE, ...layout, deviceInfo: { manufacturer: 'Acme', model: 'T100' } },
      [
        service,
        { ...service, id: 'o-2', kind: 'device-info', subject: 'manufacturer', value: 'Acme' },
      ],
      kb,
      DEFAULT_LOOP_CONFIG,
      2,
    );
    expect(second).toMatchObject({
      version: 2,
      previousVersion: 1,
      maker: 'Acme',
      model: 'T100',
      confidence: 0.5,
    });
    expect(tracker.all().map((h) => h.version)).toEqual([1, 2]);
  });

  it('forms nothing without a standard service', () => {
    expect(
      new HypothesisTracker('i').rescore(1, INITIAL_STATE, [], kb, DEFAULT_LOOP_CONFIG, 1),
    ).toBeNull();
  });
});
