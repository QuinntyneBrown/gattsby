import type { MissingToolRequest } from '../store/model/missing-tool-request';
import type { MissingToolSource } from '../store/model/missing-tool-source';
import type { Stage } from '../store/model/stage';

export function missingToolKey(capability: string): string {
  return capability
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\p{P}+$/u, '')
    .trim();
}

export function mergeMissingToolRequest(
  request: MissingToolRequest,
  reason: string,
  evidence: readonly string[],
  stage: Stage,
  source: MissingToolSource,
  now: number,
): MissingToolRequest {
  return {
    ...request,
    reasons: [...new Set([...(request.reasons ?? [request.reason]), reason])],
    evidence: [...new Set([...request.evidence, ...evidence])],
    stages: [...new Set([...(request.stages ?? []), stage])],
    sources: [...new Set([...(request.sources ?? []), source])],
    occurrences: (request.occurrences ?? 1) + 1,
    lastRaisedAt: now,
  };
}

export function applyMissingToolUpdates(
  saved: readonly MissingToolRequest[],
  updates: readonly MissingToolRequest[],
): MissingToolRequest[] {
  return [...new Map([...saved, ...updates].map((row) => [row.id, row])).values()];
}
