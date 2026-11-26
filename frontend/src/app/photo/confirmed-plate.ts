import type { Observation } from '../store/model/observation';

export function confirmedPlate(
  observations: readonly Observation[],
): ReadonlyMap<string, Observation> {
  const fields = new Map<string, Observation>();
  for (const observation of observations) {
    if (observation.kind === 'plate-read') fields.set(observation.subject, observation);
  }
  return fields;
}
