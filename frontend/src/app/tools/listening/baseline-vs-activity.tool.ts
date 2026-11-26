import type { PacketSample } from '../../analysis/packet-sample';
import { observeVaryingGroups } from '../analysis/find-varying-bytes.tool';
import { requestActionTool, type RequestActionOutput } from '../person/request-action.tool';
import type { ToolContext } from '../tool-context';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';
import { recordNotifications } from './subscribe-and-record.tool';

interface ComparisonInput {
  readonly characteristics: readonly string[];
  readonly seconds: number;
  readonly action: string;
}

export const baselineVsActivityTool = entry<ComparisonInput, unknown>({
  name: 'baseline_vs_activity',
  group: 'Listening',
  description: 'Record an idle baseline and one activity, then compare the recorded bytes.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['characteristics', 'seconds', 'action'],
    properties: {
      characteristics: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        uniqueItems: true,
        items: { type: 'string' },
      },
      seconds: { type: 'integer', minimum: 5, maximum: 60 },
      action: { type: 'string', minLength: 1, maxLength: 140 },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'listen',
  modelSelectable: false,
  preconditions: [],
  stages: ['proprietary'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: () => 'Recording notifications',
    purpose: () => 'Compare an idle baseline with one activity',
    detail: 'Keep going while Gattsby listens to the device.',
    card: true,
  },
  async run(input, ctx) {
    if (!Number.isInteger(input.seconds) || input.seconds < 5 || input.seconds > 60)
      return fail('INVALID_INPUT', 'Record for 5 to 60 seconds.');
    if (typeof input.action !== 'string' || input.action.length < 1 || input.action.length > 140)
      return fail('INVALID_INPUT', 'The activity instruction must be 1 to 140 characters.');

    const baselineId = `rec-${ctx.stepN}-baseline`;
    const baseline = await capture(input, ctx, baselineId, 'baseline');
    if (!baseline.result.ok) return baseline.result;
    if (baseline.result.data.interrupted)
      return fail('ABORTED', 'The baseline recording was interrupted.');

    const reply = await requestActionTool.run({ instruction: input.action, needsReady: true }, ctx);
    if (!reply.ok) return reply;
    if ((reply.data as RequestActionOutput).skipped)
      return fail('USER_CANCELLED', 'The activity was skipped. The baseline was kept.');

    const activityId = `rec-${ctx.stepN}-activity`;
    const activity = await capture(input, ctx, activityId, input.action);
    if (!activity.result.ok) return activity.result;
    if (activity.result.data.interrupted)
      return fail('ABORTED', 'The activity recording was interrupted.');

    const { findVaryingBytes } = await import('../../analysis/varying-bytes-finder');
    const { perCharacteristic, skipped } = findVaryingBytes([
      {
        id: baselineId,
        label: 'baseline',
        characteristics: input.characteristics,
        packets: baseline.packets,
      },
      {
        id: activityId,
        label: input.action,
        characteristics: input.characteristics,
        packets: activity.packets,
      },
    ]);
    const compared = new Map<string, Set<number>>();
    for (const group of perCharacteristic) {
      const offsets = compared.get(group.uuid) ?? new Set();
      group.betweenLabels.forEach((offset) => offsets.add(offset));
      compared.set(group.uuid, offsets);
    }
    observeVaryingGroups(
      ctx,
      perCharacteristic.filter(({ betweenLabels }) => betweenLabels.length),
    );
    const changed = [...compared].flatMap(([uuid, offsets]) =>
      offsets.size ? [{ uuid, offsets: [...offsets].sort((a, b) => a - b) }] : [],
    );
    const unchanged = [...compared].filter(([, offsets]) => !offsets.size).map(([uuid]) => uuid);
    const summary = changed.length
      ? `Bytes changed with activity in ${changed.length} characteristics.`
      : 'No comparable bytes changed with activity.';
    return ok(
      skipped.length || compared.size < input.characteristics.length
        ? `${summary} Some packet formats had too few comparable values.`
        : summary,
      { baselineId, activityId, changed, unchanged },
      [baselineId, activityId],
    );
  },
});

async function capture(input: ComparisonInput, ctx: ToolContext, id: string, label: string) {
  const packets: PacketSample[] = [];
  const counts = new Map<string, number>();
  const result = await recordNotifications({ ...input, label }, ctx, id, (sample) => {
    const count = counts.get(sample.uuid) ?? 0;
    if (count >= 192) return;
    counts.set(sample.uuid, count + 1);
    packets.push(sample);
  });
  return { packets, result };
}
