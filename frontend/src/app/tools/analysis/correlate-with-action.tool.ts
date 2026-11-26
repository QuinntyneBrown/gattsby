import type { FieldCandidate } from '../../analysis/field-candidate';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export const correlateWithActionTool = entry<
  { recordingIds: readonly string[]; order: readonly string[] },
  { ranked: readonly FieldCandidate[] }
>({
  name: 'correlate_with_action',
  group: 'Analysis',
  description: 'Rank candidate fields by their correlation with the recorded activity levels.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['recordingIds', 'order'],
    properties: {
      recordingIds: {
        type: 'array',
        minItems: 3,
        maxItems: 6,
        uniqueItems: true,
        items: { type: 'string' },
      },
      order: {
        type: 'array',
        minItems: 3,
        maxItems: 6,
        uniqueItems: true,
        items: { type: 'string' },
      },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [],
  requiredCapabilities: [],
  stages: ['proprietary'],
  phase: 'P2',
  labels: {
    running: () => 'Ranking fields by effort',
    purpose: () => 'See which fields follow effort',
    card: true,
  },
  async run({ recordingIds, order }, ctx) {
    if (
      recordingIds.length < 3 ||
      recordingIds.length > 6 ||
      new Set(order).size < 3 ||
      new Set(recordingIds).size !== recordingIds.length
    )
      return fail('INSUFFICIENT_DATA', 'Three recordings with different effort levels are needed.');
    const { loadRecordingSamples } = await import('./load-recording-samples');
    const { correlateFields } = await import('../../analysis/field-correlator');
    const samples = await loadRecordingSamples(ctx, recordingIds);
    const ranked = correlateFields(samples, order);
    if (!ranked.length)
      return fail('INSUFFICIENT_DATA', 'No packet format had enough data at three effort levels.');
    const best = ranked[0];
    const percent = Math.round(Math.abs(best.correlation) * 100);
    const id = ctx.observe({
      kind: 'field-correlation',
      subject: best.uuid,
      value: `${best.offset}/${best.width}/${best.byteOrder}`,
      text: `Field correlation: offset ${best.offset}, ${best.width} bytes, ${percent}% with effort.`,
      tag: 'likely',
      evidence: [...recordingIds],
    });
    return ok(
      `Ranked ${ranked.length} fields. The best candidate has ${percent}% correlation with effort.`,
      { ranked },
      [id, ...recordingIds],
    );
  },
});
