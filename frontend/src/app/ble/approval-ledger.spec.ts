import { describe, expect, it } from 'vitest';
import { FTMS_CONTROL_POINT, FTMS_SERVICE } from '../knowledge-base/ftms-control-point';
import type { ApprovalDecision } from '../store/model/approval-decision';
import { ApprovalLedger } from './approval-ledger';

const approval: ApprovalDecision = {
  id: 'approval',
  decision: 'send',
  decidedAt: 1,
  standClearConfirmed: false,
  request: {
    tool: 'request_control',
    title: 'Request control?',
    detail: 'Ask the device for control.',
    risk: 'No motion',
    sequence: 'Command 1 of 3',
    isMotion: false,
    deviceId: 'device',
    connectedAt: 0,
    service: FTMS_SERVICE,
    characteristic: FTMS_CONTROL_POINT,
    bytes: [0],
  },
};

function consume(ledger: ApprovalLedger, id = approval.id, bytes = [0], connectedAt = 0) {
  ledger.consume(
    id,
    'device',
    connectedAt,
    FTMS_SERVICE,
    FTMS_CONTROL_POINT,
    Uint8Array.from(bytes),
  );
}

describe('Approval ledger (NFR-018)', () => {
  it('refuses a missing approval, other bytes, another connection and reuse', () => {
    const ledger = new ApprovalLedger();
    ledger.issue(approval);
    expect(() => consume(ledger, 'missing')).toThrow('no matching approval');
    expect(() => consume(ledger, approval.id, [1])).toThrow('no matching approval');
    expect(() => consume(ledger, approval.id, [0], 2)).toThrow('no matching approval');
    consume(ledger);
    expect(() => consume(ledger)).toThrow('no matching approval');
  });

  it('requires stand-clear confirmation for motion', () => {
    const ledger = new ApprovalLedger();
    expect(() =>
      ledger.issue({ ...approval, request: { ...approval.request, isMotion: true } }),
    ).toThrow('needs approval');
  });

  it('revokes a pending approval and refuses new approvals when stopped', () => {
    const ledger = new ApprovalLedger();
    ledger.issue(approval);
    ledger.lock();
    expect(() => consume(ledger)).toThrow('Emergency stop was used');
    expect(() => ledger.issue(approval)).toThrow('Emergency stop was used');
    ledger.begin();
    expect(() => consume(ledger)).toThrow('no matching approval');
  });
});
