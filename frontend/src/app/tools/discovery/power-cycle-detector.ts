import type { AdvertisementSample } from '../../store/model/advertisement-sample';

const GAP_MS = 4_000;
const BASELINE_MAX_INTERVAL_MS = 2_000;
const END_TOLERANCE_MS = 2_000;

export function findReturningCandidate(
  observations: ReadonlyMap<string, readonly AdvertisementSample[]>,
  askedAt: number,
  doneAt: number,
): { id: string; evidence: readonly string[] } | null {
  const matches: { id: string; evidence: string[] }[] = [];
  for (const [id, samples] of observations) {
    const baseline = samples.filter(({ t }) => t <= askedAt).slice(-2);
    if (baseline.length < 2 || baseline[1].t - baseline[0].t > BASELINE_MAX_INTERVAL_MS) continue;
    const index = samples.findIndex((entry, index) => {
      const before = samples[index - 1];
      return (
        before &&
        before.t >= askedAt - BASELINE_MAX_INTERVAL_MS &&
        entry.t - before.t >= GAP_MS &&
        entry.t >= doneAt - END_TOLERANCE_MS &&
        entry.t <= doneAt + END_TOLERANCE_MS
      );
    });
    if (index > 0)
      matches.push({ id, evidence: [samples[index - 1].evidenceId, samples[index].evidenceId] });
  }
  return matches.length === 1 ? matches[0] : null;
}
