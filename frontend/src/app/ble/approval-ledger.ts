import { Injectable } from '@angular/core';
import type { ApprovalDecision } from '../store/model/approval-decision';
import type { ApprovalRequest } from '../store/model/approval-request';
import { ToolError } from '../tools/tool-error';

@Injectable({ providedIn: 'root' })
export class ApprovalLedger {
  private readonly unused = new Map<string, ApprovalRequest>();
  private locked = false;

  begin(): void {
    this.locked = false;
    this.unused.clear();
  }

  ensureOpen(): void {
    if (this.locked) throw new ToolError('EMERGENCY_STOPPED', 'Emergency stop was used.');
  }

  issue(approval: ApprovalDecision): void {
    this.ensureOpen();
    if (
      approval.decision !== 'send' ||
      (approval.request.isMotion && !approval.standClearConfirmed)
    ) {
      throw new ToolError('APPROVAL_REQUIRED', 'This command needs approval.');
    }
    this.unused.set(approval.id, { ...approval.request, bytes: [...approval.request.bytes] });
  }

  consume(
    id: string,
    deviceId: string,
    connectedAt: number,
    service: string,
    characteristic: string,
    bytes: Uint8Array,
  ): void {
    this.ensureOpen();
    const token = this.unused.get(id);
    if (
      !token ||
      token.deviceId !== deviceId ||
      token.connectedAt !== connectedAt ||
      token.service !== service ||
      token.characteristic !== characteristic ||
      token.bytes.length !== bytes.length ||
      token.bytes.some((value, index) => value !== bytes[index])
    ) {
      throw new ToolError('APPROVAL_REQUIRED', 'This write has no matching approval.');
    }
    this.unused.delete(id);
  }

  revoke(id: string): void {
    this.unused.delete(id);
  }

  lock(): void {
    this.locked = true;
    this.unused.clear();
  }
}
