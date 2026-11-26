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
      if (facts.observations.some(({ kind }) => kind === 'varying-field')) {
        return 'Some bytes changed with effort. The recordings show where the readings may be encoded.';
      }
      return protocol && facts.protocolKnown
        ? `Identified as ${protocol} from its services${maker ? ' and Device Information' : ''}. No metric has been confirmed with live data yet.`
        : 'Some fields were decoded, but not enough to name a known protocol.';
    case 'needsMissingTool':
      if (facts.missingToolRequests.some(({ sources }) => sources?.includes('encrypted')))
        return 'I connected, but the device protected some data. The missing-tool request shows where access was refused.';
      return facts.everConnected
        ? 'I connected, but what it exposes isn’t in my knowledge base, so I couldn’t decode it.'
        : 'The scans and checks did not establish why the device was unreachable.';
    case 'notConnectable':
      return facts.reachability?.likelyCauses.includes('held by another central')
        ? 'Chrome could not connect. Another app or watch may still be holding the connection.'
        : 'The device was not recognised in three Bluetooth Low Energy scans after checking power, other connections and range. It may use Bluetooth Classic, ANT+, Wi-Fi or USB. Chrome’s Bluetooth connection only works with Bluetooth Low Energy.';
    case 'stoppedByPerson':
      return 'You stopped the investigation before a verdict. Everything found so far is kept.';
  }
}

// Conclude: finish with the verdict the evidence supports (FR-054).
export const CONCLUDE_RULES: readonly StageRule[] = [
  {
    id: 'conclude.assess-reachability',
    stage: 'conclude',
    when: ({ state, facts }) =>
      facts.stopReason === 'finish' &&
      !state.everConnected &&
      !state.reachability &&
      state.scans.length > 0,
    then: () => decided('conclude.assess-reachability', 'conclude', 'assess_reachability', {}),
  },
  {
    id: 'conclude.finish',
    stage: 'conclude',
    when: ({ state }) => !state.finished,
    then: ({ facts }) => {
      const kind = deriveVerdict(facts) ?? 'needsMissingTool';
      const summary = verdictSummary(kind, facts);
      return decided('conclude.finish', 'conclude', 'finish', {
        verdict: kind,
        summary:
          facts.stopReason === 'emergencyStop'
            ? `Emergency stop used. ${facts.emergencyAcknowledged ? 'The device acknowledged Stop.' : 'Gattsby disconnected.'} If the machine is still moving, use its own stop. ${summary}`.slice(
                0,
                280,
              )
            : summary,
      });
    },
  },
];
