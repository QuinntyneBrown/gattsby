import { inject, Injectable } from '@angular/core';
import { BleLayer } from '../../ble/ble-layer';
import { toHex } from '../../ble/hex-codec';
import {
  FTMS_CONTROL_POINT,
  FTMS_SERVICE,
  FTMS_STATUS,
} from '../../knowledge-base/ftms-control-point';
import type { GattServiceInfo } from '../../ble/gatt-layout';
import { Clock } from '../../shared/clock';
import type { ApprovalDecision } from '../../store/model/approval-decision';
import { ToolError } from '../tool-error';

const RESULTS = [
  null,
  { result: 'success', label: 'Success' },
  { result: 'opNotSupported', label: 'Op code not supported' },
  { result: 'invalidParameter', label: 'Invalid parameter' },
  { result: 'operationFailed', label: 'Operation failed' },
  { result: 'controlNotPermitted', label: 'Control not permitted' },
] as const;

const TIMEOUT_MS = 5_000;

@Injectable()
export class ControlPointExchange {
  private readonly ble = inject(BleLayer);
  private readonly clock = inject(Clock);
  private loss: { connectedAt: number; evidence: string } | null = null;

  async watchPermission(
    layout: readonly GattServiceInfo[] | null,
    connectedAt: number,
  ): Promise<void> {
    this.loss = null;
    const status = layout
      ?.find((service) => service.uuid === FTMS_SERVICE)
      ?.characteristics.find((entry) => entry.uuid === FTMS_STATUS);
    if (!status?.properties.includes('notify')) return;
    await this.ble.subscribe(FTMS_SERVICE, FTMS_STATUS, ({ bytes, entryId }) => {
      if (bytes.length === 1 && bytes[0] === 0xff) this.loss ??= { connectedAt, evidence: entryId };
      return undefined;
    });
  }

  permissionLoss(connectedAt: number): string | null {
    return this.loss?.connectedAt === connectedAt ? this.loss.evidence : null;
  }

  async send(approval: ApprovalDecision, signal: AbortSignal, checkBeforeWrite?: () => void) {
    signal.throwIfAborted();
    const cleanup = new AbortController();
    const bytes = Uint8Array.from(approval.request.bytes);
    let awaitingResponse = false;
    let respond!: (response: {
      result: NonNullable<(typeof RESULTS)[number]>;
      raw: string;
      id: string;
    }) => void;
    const indication = new Promise<Parameters<typeof respond>[0]>((resolve) => {
      respond = resolve;
    });
    const abort = new Promise<never>((_, reject) => {
      const interrupted = () => reject(new ToolError('ABORTED', 'The command was stopped.'));
      if (signal.aborted) interrupted();
      else signal.addEventListener('abort', interrupted, { once: true, signal: cleanup.signal });
    });
    let stop: (() => Promise<void>) | undefined;
    const connection = async () => {
      stop = await this.ble.subscribe(
        FTMS_SERVICE,
        FTMS_CONTROL_POINT,
        ({ bytes: read, entryId }) => {
          const result = RESULTS[read[2]];
          if (
            awaitingResponse &&
            read.length === 3 &&
            read[0] === 0x80 &&
            read[1] === bytes[0] &&
            result
          ) {
            respond({ result, raw: toHex(read), id: entryId });
          }
          return undefined;
        },
      );
      if (signal.aborted || cleanup.signal.aborted) {
        await stop();
        throw new ToolError('ABORTED', 'The command was stopped.');
      }
      checkBeforeWrite?.();
      awaitingResponse = true;
      const write = await this.ble.write(FTMS_SERVICE, FTMS_CONTROL_POINT, bytes, approval.id);
      const reply = await indication;
      return { ...reply.result, sent: toHex(bytes), raw: reply.raw, evidence: [write, reply.id] };
    };
    let stopTimer: () => void = () => undefined;
    const timeout = new Promise<never>((_, reject) => {
      stopTimer = this.clock.setTimeout(
        () =>
          reject(new ToolError('TIMEOUT', 'The control point did not answer within 5 seconds.')),
        TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([connection(), abort, timeout]);
    } finally {
      cleanup.abort();
      stopTimer();
      await stop?.();
    }
  }
}
