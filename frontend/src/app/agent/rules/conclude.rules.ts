import { deriveVerdict } from '../../outcome/verdict-builder';
import type { VerdictFacts } from '../../outcome/verdict-builder';
import type { VerdictKind } from '../../store/model/verdict';
import { decided, type StageRule } from '../stage-rule';

/** The per-kind summary for a verdict the rules issue (issue-the-verdict design, rule 7). */
export function verdictSummary(kind: VerdictKind, facts: VerdictFacts): string {
  const protocol = facts.hypothesis?.protocol ?? null;
  const maker = facts.observations.some((o) => o.kind === 'device-info');
  switch (kind) {
    case 'connected':
      return `Your software can connect to this device with ${protocol}.`;
    case 'partiallyDecoded':
      return protocol && facts.protocolKnown
        ? `Identified as ${protocol} from its services${maker ? ' and Device Information' : ''}. No metric has been confirmed with live data yet.`
        : 'Some fields were decoded, but not enough to name a known protocol.';
    case 'needsMissingTool':
      return 'I connected, but what it exposes isn’t in my knowledge base, so I couldn’t decode it.';
    case 'notConnectable':
      return 'I couldn’t reach a Bluetooth Low Energy device here.';
    case 'stoppedByPerson':
      return 'You stopped the investigation before a verdict. Everything found so far is kept.';
  }
}

// Conclude: finish with the verdict the evidence supports (FR-054).
export const CONCLUDE_RULES: readonly StageRule[] = [
  {
    id: 'conclude.finish',
    stage: 'conclude',
    when: ({ state }) => !state.finished,
    then: ({ facts }) => {
      const kind = deriveVerdict(facts) ?? 'needsMissingTool';
      return decided('conclude.finish', 'conclude', 'finish', {
        verdict: kind,
        summary: verdictSummary(kind, facts),
      });
    },
  },
];
