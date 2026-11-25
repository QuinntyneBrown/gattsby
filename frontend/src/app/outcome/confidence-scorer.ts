import type { Observation } from '../store/model/observation';
import type { ScoreContribution } from '../store/model/hypothesis';

// The deterministic confidence for a protocol (track-the-hypothesis design). Weights are code
// constants calibrated to the mocks' progression (35 % after the layout, 65 % after Device
// Information and the profile match); the model's number never enters.
export const WEIGHTS = {
  serviceInLayout: 0.35,
  makerAgrees: 0.15,
  profileMatched: 0.15,
  dataDecoded: 0.1,
  metricConfirmed: 0.1,
  secondConfirmation: 0.1,
} as const;

const MATCH_SCORE = 70;

/** `protocolService` is the protocol's service UUID, or null for a protocol the KB lacks. */
export function scoreConfidence(
  protocolService: string | null,
  observations: readonly Observation[],
): { confidence: number; contributions: ScoreContribution[] } {
  const contributions: ScoreContribution[] = [];
  const add = (rule: keyof typeof WEIGHTS, found: readonly Observation[]) => {
    if (found.length > 0) {
      contributions.push({ rule, weight: WEIGHTS[rule], observationIds: found.map((o) => o.id) });
    }
  };
  if (protocolService) {
    add(
      'serviceInLayout',
      observations.filter((o) => o.kind === 'service' && o.subject === protocolService),
    );
    add(
      'makerAgrees',
      observations.filter((o) => o.kind === 'device-info' && o.subject === 'manufacturer'),
    );
    add(
      'profileMatched',
      observations.filter(
        (o) =>
          o.kind === 'profile-match' &&
          o.subject === protocolService &&
          Number(o.value) >= MATCH_SCORE,
      ),
    );
  }
  add(
    'dataDecoded',
    observations.filter((o) => o.kind === 'data-decoded' && o.subject === protocolService),
  );
  const confirmed = observations.filter((o) => o.kind === 'metric-confirmed');
  add('metricConfirmed', confirmed.slice(0, 1));
  add('secondConfirmation', confirmed.slice(1, 2));
  const sum = contributions.reduce((total, c) => total + c.weight, 0);
  return { confidence: Math.round(Math.min(1, Math.max(0, sum)) * 100) / 100, contributions };
}

export type ConfidenceWord = 'confirmed' | 'likely' | 'guess';

/** The word that goes with a confidence (NFR-011: never colour alone). */
export function confidenceWord(confidence: number, finishConfidence = 0.9): ConfidenceWord {
  if (confidence >= finishConfidence) return 'confirmed';
  return confidence >= 0.5 ? 'likely' : 'guess';
}
