import type { DecodedMetric } from './decoded-metric';

export type MetricLayoutField = Omit<DecodedMetric, 'value' | 'offset'>;
