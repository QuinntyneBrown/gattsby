import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import type { Observation } from '../store/model/observation';
import { isProtected } from '../tools/protected-characteristic';
import type { DecisionState } from './decision-state';

export function knownDataSubscriptions(
  state: DecisionState,
  kb: KnowledgeBaseIndex,
  observations: readonly Observation[],
) {
  if (state.handshakeAttempted || !state.connected || !state.layout) return [];
  const matching = new Set(
    state.vendorMatches
      ?.filter(({ hasHandshake, matchedOn }) => hasHandshake && matchedOn.includes('uuid'))
      .map(({ vendor }) => vendor),
  );
  return kb.vendors.flatMap((vendor) =>
    matching.has(vendor.id)
      ? (vendor.handshakes ?? []).flatMap((handshake) => {
          const layout = state.layout?.find(({ uuid }) => uuid === handshake.service);
          const command = layout?.characteristics.find(({ uuid }) => uuid === handshake.command);
          const data = layout?.characteristics.find(({ uuid }) => uuid === handshake.data);
          if (
            !command?.properties.includes('write') ||
            !data?.properties.includes('notify') ||
            kb.isBlocklisted(handshake.command, 'writes') ||
            kb.isBlocklisted(handshake.data, 'all') ||
            isProtected(observations, handshake.command) ||
            isProtected(observations, handshake.data)
          ) {
            return [];
          }
          const source = vendor.sources?.[handshake.source];
          return source ? [{ vendor, handshake, source }] : [];
        })
      : [],
  );
}
