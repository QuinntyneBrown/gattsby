import type { MissingToolSource } from './missing-tool-source';
import type { Stage } from './stage';

// A capability the agent lacked (FR-058).
export interface MissingToolRequest {
  readonly investigationId: string;
  /** Evidence ID, `m-` and a number. */
  readonly id: string;
  readonly capabilityKey: string;
  readonly title: string;
  readonly reason: string;
  readonly evidence: readonly string[];
  readonly stepN: number;
  readonly createdAt: number;
  /** Optional on earlier records. */
  readonly lastRaisedAt?: number;
  readonly occurrences?: number;
  readonly reasons?: readonly string[];
  readonly sources?: readonly MissingToolSource[];
  readonly stages?: readonly Stage[];
}
