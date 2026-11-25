import { inject, Injectable, signal } from '@angular/core';
import { ApprovalLedger } from '../ble/approval-ledger';
import { Clock } from '../shared/clock';
import type { ApprovalDecision } from '../store/model/approval-decision';
import type { ApprovalRequest } from '../store/model/approval-request';
import { ToolError } from '../tools/tool-error';

@Injectable()
export class ApprovalGate {
  private readonly ledger = inject(ApprovalLedger);
  private readonly clock = inject(Clock);
  private readonly prompt = signal<ApprovalRequest | null>(null);
  private readonly busySignal = signal(false);
  private pending: ((decision: ApprovalDecision['decision'], standClear: boolean) => void) | null =
    null;
  private readonly denied = new Map<string, number>();
  readonly request = this.prompt.asReadonly();
  readonly busy = this.busySignal.asReadonly();

  async approve(
    request: ApprovalRequest,
    step: number,
    signal: AbortSignal,
    record: (decision: ApprovalDecision) => void,
  ): Promise<ApprovalDecision> {
    this.ledger.ensureOpen();
    signal.throwIfAborted();
    const key = JSON.stringify([
      request.tool,
      request.deviceId,
      request.characteristic,
      request.bytes,
    ]);
    const prior = this.denied.get(key);
    if (prior !== undefined && step - prior <= 3) {
      throw new ToolError('APPROVAL_DENIED', 'This command was declined.');
    }
    this.prompt.set(request);
    const approval = await new Promise<ApprovalDecision>((resolve, reject) => {
      const abort = () => {
        this.pending = null;
        reject(new ToolError('ABORTED', 'The approval was withdrawn.'));
      };
      this.pending = (decision, standClearConfirmed) => {
        if (decision === 'send' && request.isMotion && !standClearConfirmed) return;
        this.pending = null;
        signal.removeEventListener('abort', abort);
        if (decision === 'send') this.busySignal.set(true);
        resolve({
          id: `a-${crypto.randomUUID()}`,
          request,
          decision,
          standClearConfirmed,
          decidedAt: this.clock.now(),
        });
      };
      signal.addEventListener('abort', abort, { once: true });
    });
    record(approval);
    if (approval.decision !== 'send') {
      this.denied.set(key, step);
      throw new ToolError('APPROVAL_DENIED', 'Not sent. The person declined this command.');
    }
    signal.throwIfAborted();
    this.ledger.issue(approval);
    return approval;
  }

  respond(decision: ApprovalDecision['decision'], standClear = false): void {
    this.pending?.(decision, standClear);
  }

  clear(approvalId?: string): void {
    if (approvalId) this.ledger.revoke(approvalId);
    this.prompt.set(null);
    this.busySignal.set(false);
  }
}
