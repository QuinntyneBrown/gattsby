import data from '../../knowledge-base/generated/knowledge-base.json';
import type { KnowledgeBaseData } from './knowledge-base-data';
import { KnowledgeBaseIndex } from './knowledge-base-index';

/** The real, generated knowledge base, for unit tests. */
export function realKnowledgeBase(): KnowledgeBaseIndex {
  return new KnowledgeBaseIndex(data as unknown as KnowledgeBaseData);
}

/** The real knowledge base with extra data merged in, as a new data file would add it. */
export function knowledgeBaseWith(extra: Partial<KnowledgeBaseData>): KnowledgeBaseIndex {
  const base = data as unknown as KnowledgeBaseData;
  return new KnowledgeBaseIndex({
    ...base,
    ...extra,
    vendors: [...base.vendors, ...(extra.vendors ?? [])],
    knownServiceUuids: [...base.knownServiceUuids, ...(extra.knownServiceUuids ?? [])],
  });
}
