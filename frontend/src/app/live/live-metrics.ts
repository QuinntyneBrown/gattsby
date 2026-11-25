import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { DecodedMetric } from '../knowledge-base/decoders/decoded-metric';

@Injectable()
export class LiveMetrics {
  private readonly latest = new Map<string, DecodedMetric>();
  private readonly published = signal<readonly DecodedMetric[]>([]);
  private frame: number | null = null;
  readonly metrics = this.published.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.latest.clear();
    });
  }

  update(fields: readonly DecodedMetric[]): void {
    for (const field of fields) this.latest.set(field.metric, field);
    this.frame ??= requestAnimationFrame(() => {
      this.frame = null;
      this.published.set([...this.latest.values()]);
    });
  }
}
