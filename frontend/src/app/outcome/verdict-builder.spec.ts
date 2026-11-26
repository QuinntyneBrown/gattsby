import { describe, expect, it } from 'vitest';
import type { Observation } from '../store/model/observation';
import { checkVerdict, deriveVerdict, verdictLabel, type VerdictFacts } from './verdict-builder';

const observation = (kind: string): Observation => ({
  investigationId: 'i',
  id: `o-${kind}`,
  stepN: 1,
  kind,
  subject: 's',
  value: 'v',
  text: kind,
  tag: 'confirmed',
  evidence: [],
});

const base: VerdictFacts = {
  hypothesis: null,
  observations: [],
  missingToolRequests: [],
  everConnected: true,
  stopReason: 'finish',
  protocolKnown: true,
};

describe('VerdictBuilder (FR-054)', () => {
  it('refuses “Connected” without a metric confirmed by live data (TOOL-030 AC1)', () => {
    const check = checkVerdict('connected', {
      ...base,
      observations: [observation('device-info')],
    });
    expect(check.supported).toBe(false);
  });

  it('issues “Connected” once a metric is confirmed', () => {
    expect(deriveVerdict({ ...base, observations: [observation('metric-confirmed')] })).toBe(
      'connected',
    );
  });

  it('issues “Partially decoded” for an identified protocol with decoded fields only', () => {
    expect(deriveVerdict({ ...base, observations: [observation('decoded-value')] })).toBe(
      'partiallyDecoded',
    );
  });

  it('issues “Needs a missing tool” when nothing was decoded but a request was raised', () => {
    expect(
      deriveVerdict({
        ...base,
        missingToolRequests: [
          {
            investigationId: 'i',
            id: 'm-1',
            capabilityKey: 'k',
            title: 't',
            reason: 'r',
            evidence: [],
            stepN: 1,
            createdAt: 0,
          },
        ],
      }),
    ).toBe('needsMissingTool');
  });

  it('issues “Not connectable” when an assessment shows the device is unreachable', () => {
    expect(
      deriveVerdict({
        ...base,
        everConnected: false,
        reachability: {
          reachable: 'no',
          likelyCauses: ['Bluetooth Classic'],
          ruledOut: ['off or asleep'],
        },
      }),
    ).toBe('notConnectable');
  });

  it('requires a reachability assessment before naming the verdict', () => {
    expect(checkVerdict('notConnectable', { ...base, everConnected: false }).supported).toBe(false);
  });

  it('gives the person’s stop precedence over everything else', () => {
    expect(
      deriveVerdict({
        ...base,
        stopReason: 'personStop',
        observations: [observation('metric-confirmed')],
      }),
    ).toBe('stoppedByPerson');
  });

  it('supports no verdict for a connected device with nothing decoded and no request', () => {
    expect(deriveVerdict(base)).toBeNull();
  });

  it('labels the connected verdict with the protocol', () => {
    expect(verdictLabel('connected', 'FTMS')).toBe('Connected — FTMS');
    expect(verdictLabel('partiallyDecoded', 'FTMS')).toBe('Partially decoded');
  });
});
