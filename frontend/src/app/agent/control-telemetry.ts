import { inject, Injectable } from '@angular/core';
import type { MetricSample } from '../analysis/metric-sample';
import { RawTrafficLog, WINDOW } from '../ble/raw-traffic-log';
import { FTMS_SERVICE } from '../knowledge-base/ftms-control-point';
import { Clock } from '../shared/clock';

const FRESH_MS = 4_000;

@Injectable()
export class ControlTelemetry {
  private readonly log = inject(RawTrafficLog);
  private readonly clock = inject(Clock);

  now(): number {
    return this.clock.now();
  }

  latest(metric: string, connectedAt: number): MetricSample | undefined {
    return this.samples(metric, Math.max(connectedAt, this.now() - FRESH_MS)).at(-1);
  }

  samples(metric: string, since: number): MetricSample[] {
    return this.log.latest(WINDOW).flatMap((row) => {
      if (row.service !== FTMS_SERVICE || row.t < since) return [];
      const value = row.decoded?.find((entry) => entry.metric === metric)?.value;
      return value !== undefined && Number.isFinite(value)
        ? [{ value, t: row.t, rawLogId: row.id }]
        : [];
    });
  }
}
