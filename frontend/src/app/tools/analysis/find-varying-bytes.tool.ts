import type { findVaryingBytes } from '../../analysis/varying-bytes-finder';
import { shortUuid } from '../../knowledge-base/uuid';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export const findVaryingBytesTool = entry<
  { recordingIds: readonly string[] },
  ReturnType<typeof findVaryingBytes>
>({
  name: 'find_varying_bytes',
  group: 'Analysis',
  description: 'Compare the same characteristics across two to six activity recordings.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['recordingIds'],
    properties: {
      recordingIds: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        uniqueItems: true,
        items: { type: 'string' },
      },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [],
  stages: ['proprietary'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Comparing the recordings',
    purpose: () => 'Find bytes that vary with effort',
    card: true,
  },
  async run({ recordingIds }, ctx) {
    if (
      !Array.isArray(recordingIds) ||
      recordingIds.length < 2 ||
      recordingIds.length > 6 ||
      new Set(recordingIds).size !== recordingIds.length
    )
      return fail('INSUFFICIENT_DATA', 'Choose between two and six different recordings.');
    const { loadRecordingSamples } = await import('./load-recording-samples');
    const { findVaryingBytes } = await import('../../analysis/varying-bytes-finder');
    const samples = await loadRecordingSamples(ctx, recordingIds);
    const report = findVaryingBytes(samples);
    const seen = new Set(samples.flatMap(({ packets }) => packets.map(({ uuid }) => uuid)));
    const recorded = new Set(samples.flatMap(({ characteristics }) => characteristics));
    for (const uuid of recorded) {
      if (seen.has(uuid)) continue;
      ctx.observe({
        kind: 'silent',
        subject: uuid,
        value: 'silent',
        text: `Silent characteristic: ${shortUuid(uuid)} sent no notifications in the recordings.`,
        tag: 'confirmed',
        evidence: [...recordingIds],
      });
    }
    for (const { characteristics } of ctx.state.layout ?? []) {
      for (const { uuid, properties } of characteristics) {
        if (
          recorded.has(uuid) ||
          !(properties.includes('notify') || properties.includes('indicate'))
        )
          continue;
        ctx.observe({
          kind: 'not-recorded',
          subject: uuid,
          value: 'not-recorded',
          text: `Not recorded: ${shortUuid(uuid)} was outside the selected characteristics.`,
          tag: 'confirmed',
          evidence: [...recordingIds],
        });
      }
    }
    const varying = report.perCharacteristic.filter(({ betweenLabels }) => betweenLabels.length);
    for (const group of varying) {
      ctx.observe({
        kind: 'varying-field',
        subject: group.uuid,
        value: `${group.length}/${group.betweenLabels.join(',')}`,
        text: `Varying bytes: ${group.betweenLabels.join(', ')} in ${group.length}-byte packets from ${shortUuid(group.uuid)}.`,
        tag: 'likely',
        evidence: group.packets.flatMap(({ recordingId, rawLogId }) => [recordingId, rawLogId]),
      });
    }
    if (!report.perCharacteristic.length)
      return fail(
        'INSUFFICIENT_DATA',
        'No two comparable recordings had at least five packets of the same length.',
      );
    return ok(
      varying.length
        ? `Fields vary with effort in ${varying.length} packet ${varying.length === 1 ? 'format' : 'formats'}.`
        : 'The comparable fields did not vary between effort levels.',
      report,
      recordingIds,
    );
  },
});
