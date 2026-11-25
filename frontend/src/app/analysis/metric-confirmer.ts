import type { MetricSample } from './metric-sample';

/** Keep a representative sample as evidence for the median. */
export function baselineMedian(samples: readonly MetricSample[]): MetricSample | null {
  if (samples.length === 0) return null;
  const ordered = [...samples].sort((a, b) => a.value - b.value);
  const middle = Math.floor(ordered.length / 2);
  const upper = ordered[middle];
  if (ordered.length % 2) return upper;
  return { ...upper, value: (ordered[middle - 1].value + upper.value) / 2 };
}
