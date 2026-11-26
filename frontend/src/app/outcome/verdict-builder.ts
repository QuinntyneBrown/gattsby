import type { Hypothesis } from '../store/model/hypothesis';
import type { MissingToolRequest } from '../store/model/missing-tool-request';
import type { Observation } from '../store/model/observation';
import type { StopReason } from '../store/model/stop-reason';
import type { VerdictKind } from '../store/model/verdict';
import type { ReachabilityAssessment } from '../analysis/reachability-assessment';

// What the verdict is checked against (issue-the-verdict design).
export interface VerdictFacts {
  readonly hypothesis: Hypothesis | null;
  readonly observations: readonly Observation[];
  readonly missingToolRequests: readonly MissingToolRequest[];
  readonly everConnected: boolean;
  readonly reachability?: ReachabilityAssessment | null;
  readonly stopReason: StopReason;
  readonly emergencyAcknowledged?: boolean;
  /** Whether the protocol is one the knowledge base holds. */
  readonly protocolKnown: boolean;
}

const DECODED = new Set(['device-info', 'data-decoded', 'decoded-value', 'varying-field']);

export type VerdictCheck =
  { readonly supported: true } | { readonly supported: false; readonly missing: string };

const ORDER: readonly VerdictKind[] = [
  'stoppedByPerson',
  'connected',
  'partiallyDecoded',
  'notConnectable',
  'needsMissingTool',
];

/** Whether the evidence supports a verdict kind (FR-054, TOOL-030). Pure. */
export function checkVerdict(kind: VerdictKind, facts: VerdictFacts): VerdictCheck {
  switch (kind) {
    case 'stoppedByPerson':
      return facts.stopReason === 'personStop'
        ? { supported: true }
        : { supported: false, missing: 'Only the person can stop an investigation.' };
    case 'connected':
      return facts.protocolKnown &&
        facts.everConnected &&
        facts.observations.some((o) => o.kind === 'metric-confirmed')
        ? { supported: true }
        : {
            supported: false,
            missing: `Connected — ${facts.hypothesis?.protocol ?? 'protocol'} needs at least one metric confirmed by live data; none is.`,
          };
    case 'partiallyDecoded':
      return facts.observations.some((o) => DECODED.has(o.kind))
        ? { supported: true }
        : { supported: false, missing: 'No field was decoded or found varying.' };
    case 'needsMissingTool':
      return facts.missingToolRequests.length > 0
        ? { supported: true }
        : { supported: false, missing: 'No missing-tool request was raised.' };
    case 'notConnectable':
      return !facts.everConnected && facts.reachability?.reachable === 'no'
        ? { supported: true }
        : {
            supported: false,
            missing: facts.everConnected
              ? 'The device did connect.'
              : 'The reachability checks do not establish that the device is unreachable.',
          };
  }
}

/** The one verdict the evidence supports, in the design's precedence; null when none does. */
export function deriveVerdict(facts: VerdictFacts): VerdictKind | null {
  return ORDER.find((kind) => checkVerdict(kind, facts).supported) ?? null;
}

export function verdictLabel(kind: VerdictKind, protocol: string | null): string {
  switch (kind) {
    case 'connected':
      return `Connected — ${protocol ?? 'unknown protocol'}`;
    case 'partiallyDecoded':
      return 'Partially decoded';
    case 'needsMissingTool':
      return 'Needs a missing tool';
    case 'notConnectable':
      return 'Not connectable';
    case 'stoppedByPerson':
      return 'Stopped by the person';
  }
}
