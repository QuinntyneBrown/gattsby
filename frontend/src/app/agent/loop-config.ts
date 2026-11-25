import { InjectionToken } from '@angular/core';

// The loop's configuration (FR-045, A-05; end-the-loop and match-known-profiles designs).
export interface LoopConfig {
  readonly finishConfidence: number;
  readonly stepBudget: number;
  readonly noProgressSteps: number;
  /** A profile at or above this score is decided by the rules (below 90, FR-021). */
  readonly profileThreshold: number;
  /** Two protocols within this many points are ambiguous (FR-021). */
  readonly profileMargin: number;
  readonly connectTimeoutMs: number;
  readonly modelTimeoutMs?: number;
}

export const DEFAULT_LOOP_CONFIG: LoopConfig = {
  finishConfidence: 0.9,
  stepBudget: 40,
  noProgressSteps: 5,
  profileThreshold: 70,
  profileMargin: 10,
  connectTimeoutMs: 10_000,
  modelTimeoutMs: 10_000,
};

export const LOOP_CONFIG = new InjectionToken<LoopConfig>('LOOP_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_LOOP_CONFIG,
});
