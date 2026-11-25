import type { MetricLayoutField } from '../knowledge-base/decoders/metric-layout-field';

export interface ReadableMetric {
  readonly metric: string;
  readonly label: string;
  readonly characteristic: string;
  readonly rule:
    | { readonly kind: 'offset'; readonly from: number; readonly to: number }
    | { readonly kind: 'flag'; readonly bit: number };
  readonly type: MetricLayoutField['type'];
  readonly scale: number;
  readonly unit: string;
  readonly rateHz?: number;
  readonly status: 'confirmed' | 'claimedOnly' | 'claimedNotSeen';
  readonly quirks: readonly string[];
  readonly evidence: readonly string[];
}
