import type { MissingToolSource } from '../store/model/missing-tool-source';
import type { Stage } from '../store/model/stage';

export interface MissingToolGroup {
  readonly capability: string;
  readonly capabilityKey: string;
  readonly status: 'open' | 'built';
  readonly count: number;
  readonly firstRaisedAt: number;
  readonly latestReason: string;
  readonly reasons: readonly string[];
  readonly stages: readonly Stage[];
  readonly sources: readonly MissingToolSource[];
  readonly investigations: readonly {
    readonly id: string;
    readonly deviceName: string;
    readonly raisedAt: number;
    readonly evidence: readonly string[];
    readonly hasVerdict: boolean;
  }[];
}
