import { describe, expect, it } from 'vitest';
import { KnowledgeBase } from '../knowledge-base/knowledge-base';
import { canonicalUuid } from '../knowledge-base/uuid';
import type { MissingToolListEntry } from '../store/model/missing-tool-list-entry';
import { groupMissingTools } from './missing-tools.service';

function entry(
  id: string,
  capabilityKey: string,
  createdAt: number,
  evidence: string,
): MissingToolListEntry {
  return {
    deviceName: id,
    hasVerdict: true,
    request: {
      investigationId: id,
      id: 'm-1',
      title: capabilityKey,
      capabilityKey,
      createdAt,
      evidence: [evidence],
      reason: 'A decoder is needed.',
      stepN: 1,
    },
  };
}

describe('Missing tools', () => {
  it('joins earlier spellings and counts distinct investigations', async () => {
    const kb = await new KnowledgeBase().load();
    const result = groupMissingTools(
      [
        entry('i-a', 'Decode X', 1, 'r-1'),
        entry('i-a', 'Decode X!', 2, 'r-2'),
        entry('i-b', 'decode x', 3, 'r-3'),
      ],
      kb,
    );
    expect(result).toEqual([
      expect.objectContaining({
        capabilityKey: 'decode x',
        status: 'open',
        count: 2,
        investigations: [expect.objectContaining({ evidence: ['r-1', 'r-2'] }), expect.anything()],
      }),
    ]);
  });

  it('places a decoder supplied by the current knowledge base after open requests', async () => {
    const kb = await new KnowledgeBase().load();
    const key = `decode-service:${canonicalUuid(0x180d)}`;
    const result = groupMissingTools(
      [entry('i-a', key, 1, 'r-1'), entry('i-b', 'Needs a decoder', 2, 'r-2')],
      kb,
    );
    expect(result.map(({ status }) => status)).toEqual(['open', 'built']);
  });
});
