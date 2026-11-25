import type { StopReason } from './stop-reason';

export type VerdictKind =
  'connected' | 'partiallyDecoded' | 'needsMissingTool' | 'notConnectable' | 'stoppedByPerson';

// The one verdict that ends an investigation (FR-054).
export interface Verdict {
  readonly kind: VerdictKind;
  readonly protocol: string | null;
  readonly label: string;
  readonly summary: string;
  readonly stopReason: StopReason;
  readonly issuedAt: number;
  readonly stepN: number;
  readonly evidence: readonly string[];
}
