import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

interface RecordInput {
  readonly service: string;
  readonly characteristic: string;
  readonly seconds: number;
}

export const subscribeAndRecordTool = entry<RecordInput, unknown>({
  name: 'subscribe_and_record',
  group: 'Listening',
  description: 'Subscribe to and record notifications from a standard characteristic.',
  inputSchema: {
    type: 'object',
    required: ['service', 'characteristic', 'seconds'],
    properties: {
      service: { type: 'string' },
      characteristic: { type: 'string' },
      seconds: { type: 'integer', minimum: 1, maximum: 120 },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'listen',
  preconditions: [],
  stages: ['standard'],
  requiredCapabilities: ['webBluetooth'],
  phase: 'MVP',
  labels: {
    running: (input, { kb }) =>
      `Recording ${kb.characteristic(input.characteristic)?.name ?? 'notifications'}`,
    purpose: (input, { kb }) =>
      `Record ${kb.characteristic(input.characteristic)?.name ?? 'notifications'}`,
    detail: 'Keep going while Gattsby listens to the device.',
    card: true,
  },
  async run(input, ctx) {
    if (!Number.isInteger(input.seconds) || input.seconds < 1 || input.seconds > 120) {
      return fail('INVALID_INPUT', 'Record for 1 to 120 seconds.');
    }
    const decoder = ctx.kb.decoderFor(input.characteristic);
    if (!decoder)
      return fail('PRECONDITION_FAILED', 'There is no decoder for this characteristic.');
    const result = await ctx.notificationRecorder.record(
      ctx.ble,
      input.service,
      input.characteristic,
      decoder,
      input.seconds,
      ctx.signal,
    );
    return ok(`${result.count} notifications, ${result.decodeErrors} decode errors.`, {
      ...result,
      silent: result.count === 0,
    });
  },
});
