import { Injectable } from '@angular/core';
import { FTMS_CONTROL_POINT, FTMS_SERVICE } from '../knowledge-base/ftms-control-point';
import type { ApprovalDecision } from '../store/model/approval-decision';
import type { ApprovalRequest } from '../store/model/approval-request';
import { ToolError } from '../tools/tool-error';

@Injectable({ providedIn: 'root' })
export class ApprovalLedger {
  private readonly unused = new Map<string, ApprovalRequest>();
  private readonly emergency = new Map<string, ApprovalRequest>();
  private locked = false;

  begin(): void {
    this.locked = false;
    this.unused.clear();
    this.emergency.clear();
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
    const tokens = this.locked ? this.emergency : this.unused;
    const token = tokens.get(id);
    if (this.locked && !token) this.ensureOpen();
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
    tokens.delete(id);
  }

  revoke(id: string): void {
    this.unused.delete(id);
    this.emergency.delete(id);
  }

  lock(): void {
    this.locked = true;
    this.unused.clear();
    this.emergency.clear();
  }

  issueEmergency(approval: ApprovalDecision): void {
    const request = approval.request;
    const bytes = request.bytes;
    const stop = bytes.length === 2 && bytes[0] === 0x08 && bytes[1] === 0x01;
    const reset = bytes.length === 1 && bytes[0] === 0x01;
    if (
      !this.locked ||
      approval.decision !== 'send' ||
      request.tool !== 'emergency_stop' ||
      request.service !== FTMS_SERVICE ||
      request.characteristic !== FTMS_CONTROL_POINT ||
      (!stop && !reset)
    ) {
      throw new ToolError(
        'APPROVAL_REQUIRED',
        'Only an approved emergency stop can use this write.',
      );
    }
    this.emergency.set(approval.id, { ...request, bytes: [...bytes] });
  }
}
