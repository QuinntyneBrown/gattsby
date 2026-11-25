import { inject, Injectable } from '@angular/core';
import type { ConfirmationMetric } from '../analysis/confirmation-metric';
import { baselineMedian } from '../analysis/metric-confirmer';
import type { MetricSample } from '../analysis/metric-sample';
import type { BleLayer } from '../ble/ble-layer';
import type { DecodedMetric } from '../knowledge-base/decoders/decoded-metric';
import { Clock } from '../shared/clock';
import { ToolError } from '../tools/tool-error';

const BASELINE_LIMIT = 500;
const WINDOW_MS = 15_000;
const MIN_CHANGE = { speed: 0.5, heartRate: 5, incline: 0.5 } as const;
const PACE_METRICS = new Map<string, number>([
  ['distance', 1],
  ['elapsed', 1],
  ['cadence', 1],
  ['power', 1],
]);

@Injectable()
export class ConfirmationCheck {
  private readonly clock = inject(Clock);
  private readonly baseline: Record<Exclude<ConfirmationMetric, 'incline'>, MetricSample[]> = {
    speed: [],
    heartRate: [],
  };
  private metric: ConfirmationMetric = 'speed';
  private reference: MetricSample | null = null;
  private qualifying: MetricSample | null = null;
  private readonly paceBaseline = new Map<string, MetricSample>();
  private readonly paceMatches = new Map<
    string,
    { field: DecodedMetric; baseline: MetricSample; t: number; rawLogId: string }
  >();
  private latestIncline: MetricSample | null = null;
  private openedAt: number | null = null;
  private wake: (() => void) | null = null;

  begin(metric: ConfirmationMetric): void {
    this.metric = metric;
    this.reference =
      metric === 'incline' ? this.latestIncline : baselineMedian(this.baseline[metric]);
    this.qualifying = null;
    this.paceMatches.clear();
    this.openedAt = this.clock.now();
  }

  sample(fields: readonly DecodedMetric[], rawLogId: string, t: number, recording: boolean): void {
    const current = fields.find((field) => field.metric === this.metric);
    const incline = fields.find((field) => field.metric === 'incline');
    if (incline) this.latestIncline = { value: incline.value, t, rawLogId };
    if (recording) {
      for (const metric of ['speed', 'heartRate'] as const) {
        const baseline = this.baseline[metric];
        const field = fields.find((candidate) => candidate.metric === metric);
        if (field && baseline.length < BASELINE_LIMIT)
          baseline.push({ value: field.value, t, rawLogId });
      }
      for (const field of fields) {
        if (PACE_METRICS.has(field.metric)) {
          this.paceBaseline.set(field.metric, { value: field.value, t, rawLogId });
        }
      }
      return;
    }
    if (this.openedAt === null || !this.reference || !current) return;
    this.qualifying ??=
      current.value - this.reference.value >= MIN_CHANGE[this.metric]
        ? { value: current.value, t, rawLogId }
        : null;
    if (this.qualifying && this.metric === 'speed' && current.value > 0) {
      for (const field of fields) {
        const baseline = this.paceBaseline.get(field.metric);
        const minimum = PACE_METRICS.get(field.metric);
        if (
          baseline &&
          minimum !== undefined &&
          !this.paceMatches.has(field.metric) &&
          field.value - baseline.value >= minimum &&
          (field.metric !== 'elapsed' || t - baseline.t >= 1000)
        ) {
          this.paceMatches.set(field.metric, { field, baseline, t, rawLogId });
        }
      }
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
    const paceMatches = qualifying
      ? Array.from(this.paceMatches.values()).filter((sample) => sample.t <= deadline)
      : [];
    this.openedAt = null;
    return {
      baseline: this.reference,
      metric: this.metric,
      qualifying,
      startedAt,
      paceMatches,
      inclineBaseline: this.latestIncline?.value ?? null,
    };
  }

  private hasResult(): boolean {
    return (
      !!this.qualifying &&
      (this.metric !== 'speed' ||
        !this.paceBaseline.has('distance') ||
        this.paceMatches.has('distance'))
    );
  }
}
