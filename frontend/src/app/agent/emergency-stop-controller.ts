import { inject, Injectable, signal } from '@angular/core';
import { ApprovalLedger } from '../ble/approval-ledger';
import { BleLayer } from '../ble/ble-layer';
import { RawTrafficLog, WINDOW } from '../ble/raw-traffic-log';
import { encodeCommand } from '../knowledge-base/command-encoder';
import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import type { ApprovalDecision } from '../store/model/approval-decision';
import type { EmergencyStopEvent } from '../store/model/emergency-stop-event';
import { ControlPointExchange } from '../tools/control/control-point-exchange';

export type EmergencyStopView = 'sending' | 'acknowledged' | 'notAcknowledged';

@Injectable()
export class EmergencyStopController {
  private readonly ble = inject(BleLayer);
  private readonly approvals = inject(ApprovalLedger);
  private readonly exchange = inject(ControlPointExchange);
  private readonly log = inject(RawTrafficLog);
  private readonly status = signal<EmergencyStopView | null>(null);
  private resolveReport: ((report: EmergencyStopEvent['reported']) => void) | null = null;
  private readonly interrupted = new AbortController();
  readonly view = this.status.asReadonly();

  async trigger(
    event: Pick<EmergencyStopEvent, 'tappedAt' | 'stage' | 'mode'>,
    kb: KnowledgeBaseIndex,
    known: boolean,
  ): Promise<EmergencyStopEvent> {
    this.approvals.lock();
    const connection = this.ble.connection();
    const command = kb.command('stop');
    if (!known || !command || !connection.deviceId || connection.connectedAt === null) {
      await this.ble.disconnect();
      return { ...event, outcome: 'noKnownStop', reported: null, approvals: [], evidence: [] };
    }
    this.status.set('sending');
    const approvals: ApprovalDecision[] = [];
    const evidence: string[] = [];
    const deviceId = connection.deviceId;
    const connectedAt = connection.connectedAt;
    const send = async (commandId: 'stop' | 'reset') => {
      const definition = kb.command(commandId);
      if (!definition) return false;
      const approval: ApprovalDecision = {
        id: `a-${crypto.randomUUID()}`,
        decision: 'send',
        decidedAt: event.tappedAt,
        standClearConfirmed: false,
        request: {
          tool: 'emergency_stop',
          title: commandId === 'stop' ? 'Emergency stop' : 'Reset the FTMS session',
          detail: 'The person tapped Emergency stop.',
          risk: 'Stops the test',
          isMotion: false,
          sequence: 'Emergency stop',
          deviceId,
          connectedAt,
          service: definition.service,
          characteristic: definition.characteristic,
          bytes: [...encodeCommand(definition)],
        },
      };
      approvals.push(approval);
      this.approvals.issueEmergency(approval);
      try {
        const result = await this.exchange.send(approval, this.interrupted.signal);
        evidence.push(...result.evidence);
        return result.result === 'success';
      } catch {
        const write = this.log.latest(WINDOW).find((entry) => entry.approvalId === approval.id);
        if (write) evidence.push(write.id);
        return false;
      } finally {
        this.approvals.revoke(approval.id);
      }
    };
    const stopped = await send('stop');
    if (stopped && !this.interrupted.signal.aborted) await send('reset');
    await this.ble.disconnect();
    const outcome = stopped ? 'acknowledged' : 'notAcknowledged';
    if (this.interrupted.signal.aborted) {
      return { ...event, outcome, reported: null, approvals, evidence };
    }
    const reported = await new Promise<EmergencyStopEvent['reported']>((resolve) => {
      this.resolveReport = resolve;
      this.status.set(outcome);
    });
    return { ...event, outcome, reported, approvals, evidence };
  }

  report(reported: EmergencyStopEvent['reported']): void {
    if (!this.resolveReport) return;
    const resolve = this.resolveReport;
    this.resolveReport = null;
    this.status.set(null);
    resolve(reported);
  }

  leave(): void {
    this.interrupted.abort();
    this.report(null);
  }
}
