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
  private baselineDistance: MetricSample | null = null;
  private qualifyingDistance: MetricSample | null = null;
  private openedAt: number | null = null;
  private wake: (() => void) | null = null;

  begin(): void {
    this.reference = baselineMedian(this.baseline);
    this.qualifying = null;
    this.qualifyingDistance = null;
    this.openedAt = this.clock.now();
  }

  sample(fields: readonly DecodedMetric[], rawLogId: string, recording: boolean): void {
    const speed = fields.find((field) => field.metric === 'speed');
    const distance = fields.find((field) => field.metric === 'distance');
    const t = this.clock.now();
    if (recording) {
      if (speed && this.baseline.length < BASELINE_LIMIT) {
        this.baseline.push({ value: speed.value, t, rawLogId });
      }
      if (distance) this.baselineDistance = { value: distance.value, t, rawLogId };
      return;
    }
    if (this.openedAt === null || !this.reference || !speed) return;
    this.qualifying ??=
      speed.value - this.reference.value >= MIN_SPEED_CHANGE
        ? { value: speed.value, t, rawLogId }
        : null;
    if (
      this.qualifying &&
      speed.value > 0 &&
      distance &&
      this.baselineDistance &&
      distance.value > this.baselineDistance.value
    ) {
      this.qualifyingDistance ??= { value: distance.value, t, rawLogId };
    }
    if (this.hasResult()) this.wake?.();
  }

  async finish(doneAt: number, ble: BleLayer, signal: AbortSignal) {
    const startedAt = this.openedAt;
    const deadline = doneAt + WINDOW_MS;
    if (this.reference && !this.hasResult() && ble.connection().status === 'connected') {
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
    const farther = this.qualifyingDistance;
    const distance = qualifying && farther && farther.t <= deadline ? farther : null;
    this.openedAt = null;
    return {
      baseline: this.reference,
      qualifying,
      startedAt,
      baselineDistance: this.baselineDistance,
      distance,
    };
  }

  private hasResult(): boolean {
    return !!this.qualifying && (!this.baselineDistance || !!this.qualifyingDistance);
  }
}
