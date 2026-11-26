import { inject, Injectable } from '@angular/core';
import { KnowledgeBase } from '../knowledge-base/knowledge-base';
import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import { InvestigationStore } from '../store/investigation-store';
import type { MissingToolListEntry } from '../store/model/missing-tool-list-entry';
import { missingToolKey } from './merge-missing-tool-requests';
import type { MissingToolGroup } from './missing-tool-group';

@Injectable({ providedIn: 'root' })
export class MissingToolsService {
  private readonly store = inject(InvestigationStore);
  private readonly knowledgeBase = inject(KnowledgeBase);

  async list(): Promise<readonly MissingToolGroup[]> {
    const [rows, kb] = await Promise.all([
      this.store.listMissingTools(),
      this.knowledgeBase.load(),
    ]);
    return groupMissingTools(rows, kb);
  }
}

export function groupMissingTools(
  rows: readonly MissingToolListEntry[],
  kb: KnowledgeBaseIndex,
): MissingToolGroup[] {
  const groups = new Map<string, MissingToolListEntry[]>();
  for (const row of rows) {
    const key = missingToolKey(row.request.capabilityKey) || row.request.capabilityKey;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups]
    .map(([key, group]) => toGroup(key, group, kb))
    .sort(
      (a, b) =>
        Number(a.status === 'built') - Number(b.status === 'built') ||
        a.firstRaisedAt - b.firstRaisedAt ||
        a.capabilityKey.localeCompare(b.capabilityKey),
    );
}

function toGroup(
  key: string,
  rows: MissingToolListEntry[],
  kb: KnowledgeBaseIndex,
): MissingToolGroup {
  rows.sort((a, b) => a.request.createdAt - b.request.createdAt);
  const first = rows[0].request;
  let latest = first;
  const investigations = new Map<string, MissingToolGroup['investigations'][number]>();
  for (const { request, deviceName, hasVerdict } of rows) {
    if ((request.lastRaisedAt ?? request.createdAt) >= (latest.lastRaisedAt ?? latest.createdAt))
      latest = request;
    const previous = investigations.get(request.investigationId);
    investigations.set(request.investigationId, {
      id: request.investigationId,
      deviceName,
      raisedAt: previous?.raisedAt ?? request.createdAt,
      hasVerdict,
      evidence: [...new Set([...(previous?.evidence ?? []), ...request.evidence])],
    });
  }
  const service = key.startsWith('decode-service:')
    ? kb.service(key.slice('decode-service:'.length))
    : undefined;
  const built = service?.characteristics.some(({ uuid }) => kb.decoderFor(uuid));
  return {
    capability: first.title,
    capabilityKey: key,
    status: built ? 'built' : 'open',
    count: investigations.size,
    firstRaisedAt: first.createdAt,
    latestReason: latest.reasons?.at(-1) ?? latest.reason,
    reasons: [...new Set(rows.flatMap(({ request }) => request.reasons ?? [request.reason]))],
    stages: [...new Set(rows.flatMap(({ request }) => request.stages ?? []))],
    sources: [...new Set(rows.flatMap(({ request }) => request.sources ?? []))],
    investigations: [...investigations.values()],
  };
}
