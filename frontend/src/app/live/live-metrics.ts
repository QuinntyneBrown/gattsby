import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { DecodedMetric } from '../knowledge-base/decoders/decoded-metric';

@Injectable()
export class LiveMetrics {
  private readonly latest = new Map<string, DecodedMetric>();
  private readonly arrivals = new Map<string, number[]>();
  private readonly published = signal<readonly DecodedMetric[]>([]);
  private readonly rate = signal<number | null>(null);
  private latestRate: number | null = null;
  private frame: number | null = null;
  readonly metrics = this.published.asReadonly();
  readonly rateHz = this.rate.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.latest.clear();
      this.arrivals.clear();
    });
  }

  update(fields: readonly DecodedMetric[], uuid: string, timestamp: number): void {
    for (const field of fields) this.latest.set(field.metric, field);
    const timestamps = this.arrivals.get(uuid) ?? [];
    timestamps.push(timestamp);
    if (timestamps.length > 10) timestamps.shift();
    this.arrivals.set(uuid, timestamps);
    const elapsed = timestamp - timestamps[0];
    if (elapsed > 0) this.latestRate = ((timestamps.length - 1) * 1000) / elapsed;
    this.frame ??= requestAnimationFrame(() => {
      this.frame = null;
      this.published.set([...this.latest.values()]);
      this.rate.set(this.latestRate);
    });
  }
}
