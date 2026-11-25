import { inject, Injectable } from '@angular/core';
import { baselineMedian } from '../analysis/metric-confirmer';
import type { MetricSample } from '../analysis/metric-sample';
import type { BleLayer } from '../ble/ble-layer';
import type { DecodedMetric } from '../knowledge-base/decoders/decoded-metric';
import { Clock } from '../shared/clock';
import { ToolError } from '../tools/tool-error';

const BASELINE_LIMIT = 500;
const WINDOW_MS = 15_000;
const MIN_SPEED_CHANGE = 0.5;

@Injectable()
export class ConfirmationCheck {
  private readonly clock = inject(Clock);
  private readonly baseline: MetricSample[] = [];
  private reference: MetricSample | null = null;
  private qualifying: MetricSample | null = null;
  private openedAt: number | null = null;
  private wake: (() => void) | null = null;

  begin(): void {
    this.reference = baselineMedian(this.baseline);
    this.qualifying = null;
    this.openedAt = this.clock.now();
  }

  sample(fields: readonly DecodedMetric[], rawLogId: string, recording: boolean): void {
    const speed = fields.find((field) => field.metric === 'speed');
    if (!speed) return;
    const sample = { value: speed.value, t: this.clock.now(), rawLogId };
    if (recording && this.baseline.length < BASELINE_LIMIT) this.baseline.push(sample);
    if (
      this.openedAt !== null &&
      this.reference &&
      !this.qualifying &&
      sample.value - this.reference.value >= MIN_SPEED_CHANGE
    ) {
      this.qualifying = sample;
      this.wake?.();
    }
  }

  async finish(doneAt: number, ble: BleLayer, signal: AbortSignal) {
    const startedAt = this.openedAt;
    const deadline = doneAt + WINDOW_MS;
    if (this.reference && !this.qualifying && ble.connection().status === 'connected') {
      await new Promise<void>((resolve, reject) => {
        const cancel = this.clock.setTimeout(close, Math.max(0, deadline - this.clock.now()));
        const disconnect = ble.disconnected.subscribe(() => close());
        const abort = (): void => close(new ToolError('ABORTED', 'The confirmation was stopped.'));
        const clear = (): void => {
          cancel();
          disconnect.unsubscribe();
          signal.removeEventListener('abort', abort);
          this.wake = null;
        };
        function close(error?: ToolError): void {
          clear();
          if (error) reject(error);
          else resolve();
        }
        this.wake = close;
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
    }
    const candidate = this.qualifying;
    const qualifying = candidate && candidate.t <= deadline ? candidate : null;
    this.openedAt = null;
    return { baseline: this.reference, qualifying, startedAt };
  }
}
