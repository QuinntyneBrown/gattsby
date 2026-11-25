import { decide } from '../knowledge-base/profile-matcher';
import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import type { DecisionState } from '../agent/decision-state';
import type { LoopConfig } from '../agent/loop-config';
import type { Hypothesis } from '../store/model/hypothesis';
import type { Observation } from '../store/model/observation';
import { scoreConfidence } from './confidence-scorer';

interface Guess {
  readonly serviceUuid: string;
  readonly protocol: string;
  readonly label: string;
  readonly deviceType: string | null;
}

/**
 * The protocol the evidence points at (track-the-hypothesis design, rule 6): the decided profile
 * once matched, otherwise the first standard service in the layout that has profiles.
 */
export function currentGuess(
  state: DecisionState,
  kb: KnowledgeBaseIndex,
  config: LoopConfig,
): Guess | null {
  if (state.candidates) {
    const decision = decide(state.candidates, config.profileThreshold, config.profileMargin);
    if (decision.kind === 'decided') {
      const c = decision.candidate;
      return {
        serviceUuid: c.serviceUuid,
        protocol: c.protocol,
        label: c.label,
        deviceType: c.deviceType,
      };
    }
  }
  for (const service of state.layout ?? []) {
    const known = kb.service(service.uuid);
    if (known && known.profiles.length > 0) {
      return {
        serviceUuid: known.uuid,
        protocol: known.shortName,
        label: known.hypothesisLabel ?? known.name,
        deviceType: null,
      };
    }
  }
  return null;
}

// Owns the hypothesis versions of one investigation (FR-053). Versions are append-only; each new
// one travels in its step's commit. The confidence is always the deterministic score.
export class HypothesisTracker {
  private readonly versions: Hypothesis[] = [];

  constructor(private readonly investigationId: string) {}

  restore(versions: readonly Hypothesis[]): void {
    this.versions.splice(
      0,
      this.versions.length,
      ...[...versions].sort((a, b) => a.version - b.version),
    );
  }

  current(): Hypothesis | null {
    return this.versions[this.versions.length - 1] ?? null;
  }

  all(): readonly Hypothesis[] {
    return this.versions;
  }

  /** Rescores after a committed step; returns the new version, or null when nothing changed. */
  rescore(
    stepN: number,
    state: DecisionState,
    observations: readonly Observation[],
    kb: KnowledgeBaseIndex,
    config: LoopConfig,
    now: number,
  ): Hypothesis | null {
    const guess = currentGuess(state, kb, config);
    if (!guess) return null;
    const info = state.deviceInfo && state.deviceInfo !== 'absent' ? state.deviceInfo : null;
    const { confidence, contributions } = scoreConfidence(guess.serviceUuid, observations);
    const previous = this.current();
    const next = {
      protocol: guess.protocol,
      label: guess.label,
      deviceType: guess.deviceType,
      maker: info?.manufacturer ?? null,
      model: info?.model ?? null,
      confidence,
    };
    if (
      previous &&
      previous.protocol === next.protocol &&
      previous.label === next.label &&
      previous.deviceType === next.deviceType &&
      previous.maker === next.maker &&
      previous.model === next.model &&
      previous.confidence === next.confidence
    ) {
      return null;
    }
    const version = (previous?.version ?? 0) + 1;
    const hypothesis: Hypothesis = {
      investigationId: this.investigationId,
      version,
      id: `h-${version}`,
      stepN,
      source: 'rules',
      previousVersion: previous?.version ?? null,
      ...next,
      evidence: [...new Set(contributions.flatMap((c) => c.observationIds))],
      contributions,
      createdAt: now,
    };
    this.versions.push(hypothesis);
    return hypothesis;
  }
}
