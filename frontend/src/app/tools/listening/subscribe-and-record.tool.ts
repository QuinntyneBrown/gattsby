import { canonicalUuid } from '../../knowledge-base/uuid';
import { ProtectedGattError } from '../../ble/protected-gatt-error';
import { entry } from '../tool-definition';
import { isProtected, recordProtected } from '../protected-characteristic';
import { fail, ok } from '../tool-result';
import type { RecordingSource } from './recording-source';
import type { PacketSample } from '../../analysis/packet-sample';
import type { ToolContext } from '../tool-context';

interface RecordInput {
  readonly characteristics: readonly string[];
  readonly seconds: number;
  readonly label?: string;
  readonly level?: number;
}

export const subscribeAndRecordTool = entry<RecordInput, unknown>({
  name: 'subscribe_and_record',
  group: 'Listening',
  description: 'Subscribe to and record notifications from one or more characteristics.',
  inputSchema: {
    type: 'object',
    required: ['characteristics', 'seconds'],
    properties: {
      characteristics: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        uniqueItems: true,
        items: { type: 'string' },
      },
      seconds: { type: 'integer', minimum: 1, maximum: 120 },
      label: { type: 'string', minLength: 1, maxLength: 140 },
      level: { type: 'integer', minimum: 0, maximum: 3 },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'listen',
  preconditions: [],
  stages: ['standard', 'proprietary'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: (input, { kb }) =>
      `Recording ${kb.characteristic(input.characteristics?.[0] ?? '')?.name ?? 'notifications'}`,
    purpose: (input, { kb }) =>
      `Record ${kb.characteristic(input.characteristics?.[0] ?? '')?.name ?? 'notifications'}`,
    detail: 'Keep going while Gattsby listens to the device.',
    card: true,
  },
  run: (input, ctx) => recordNotifications(input, ctx, `rec-${ctx.stepN}`),
});

export async function recordNotifications(
  input: RecordInput,
  ctx: ToolContext,
  recordingId: string,
  onSample?: (sample: PacketSample) => void,
) {
  if (!Number.isInteger(input.seconds) || input.seconds < 1 || input.seconds > 120) {
    return fail('INVALID_INPUT', 'Record for 1 to 120 seconds.');
  }
  if (
    !Array.isArray(input.characteristics) ||
    input.characteristics.length < 1 ||
    input.characteristics.length > 8 ||
    input.characteristics.some((uuid) => typeof uuid !== 'string')
  ) {
    return fail('INVALID_INPUT', 'Record between 1 and 8 characteristics.');
  }
  const characteristics = input.characteristics.map(canonicalUuid);
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (
    new Set(characteristics).size !== characteristics.length ||
    characteristics.some((uuid) => !valid.test(uuid))
  ) {
    return fail('INVALID_INPUT', 'Use a different valid UUID for each characteristic.');
  }
  if (
    input.label !== undefined &&
    (typeof input.label !== 'string' || input.label.length < 1 || input.label.length > 140)
  ) {
    return fail('INVALID_INPUT', 'The recording label must be 1 to 140 characters.');
  }
  if (
    input.level !== undefined &&
    (!Number.isInteger(input.level) || input.level < 0 || input.level > 3)
  ) {
    return fail('INVALID_INPUT', 'The activity level must be between 0 and 3.');
  }
  if (ctx.ble.connection().status !== 'connected') {
    return fail('NOT_CONNECTED', 'The device is not connected.');
  }
  const sources: RecordingSource[] = [];
  for (const uuid of characteristics) {
    if (isProtected(ctx.verdictFacts().observations, uuid))
      return fail('PRECONDITION_FAILED', 'The characteristic is protected.');
    const service = ctx.state.layout?.find((s) =>
      s.characteristics.some(
        (c) =>
          c.uuid === uuid && (c.properties.includes('notify') || c.properties.includes('indicate')),
      ),
    );
    if (!service)
      return fail('PROPERTY_MISSING', 'A requested characteristic does not send updates.');
    sources.push({ service: service.uuid, uuid, decoder: ctx.kb.decoderFor(uuid) });
  }
  const label = input.label ?? 'Recording';
  let result;
  try {
    result = await ctx.notificationRecorder.record(
      ctx.ble,
      sources,
      recordingId,
      input.seconds,
      ctx.signal,
      ctx.stage === 'standard',
      onSample,
    );
  } catch (error) {
    if (error instanceof ProtectedGattError)
      return fail(
        'AUTH_REQUIRED',
        error.message,
        'The characteristic is protected.',
        recordProtected(ctx, error),
      );
    throw error;
  }
  ctx.saveRecording({
    id: recordingId,
    label,
    ...(input.level !== undefined && { level: input.level }),
    characteristics,
    startedAt: result.startedAt,
    seconds: input.seconds,
    interrupted: result.interrupted,
    valueCount: result.count,
  });
  if (ctx.signal.aborted) return fail('ABORTED', 'The recording was stopped.');
  const summary = `${result.count} notifications, ${result.decodeErrors} decode errors.`;
  return ok(result.interrupted ? `The recording was interrupted. ${summary}` : summary, {
    ...result,
    label,
    recordingId,
    silent: result.count === 0,
  });
}
