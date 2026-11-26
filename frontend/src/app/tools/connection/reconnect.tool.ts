import { RECONNECT_DELAYS, waitToReconnect } from '../../ble/reconnect-policy';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export const reconnectTool = entry<
  { deviceId: string; attempts?: number },
  { connected: true; attempts: number; restoredSubscriptions: string[] }
>({
  name: 'reconnect',
  group: 'Connection',
  description: 'Reconnect to the same device and restore the earlier notification subscriptions.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['deviceId'],
    properties: {
      deviceId: { type: 'string' },
      attempts: { type: 'integer', minimum: 1, maximum: 3 },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  modelSelectable: false,
  preconditions: [],
  stages: ['identify', 'standard', 'proprietary', 'control'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: () => 'Reconnecting to the device',
    purpose: () => 'Reconnect to the same device',
    card: true,
  },
  async run(input, ctx) {
    if (!ctx.state.everConnected || ctx.state.device?.deviceId !== input.deviceId) {
      return fail('PRECONDITION_FAILED', 'The device was not connected in this investigation.');
    }
    const limit = input.attempts ?? RECONNECT_DELAYS.length;
    if (!Number.isInteger(limit) || limit < 1 || limit > RECONNECT_DELAYS.length) {
      return fail('INVALID_INPUT', 'Choose between one and three reconnect attempts.');
    }
    for (const [index, delay] of RECONNECT_DELAYS.slice(0, limit).entries()) {
      const attempts = index + 1;
      ctx.connectionAttempt?.(attempts);
      await waitToReconnect(ctx.clock, delay, ctx.signal);
      try {
        const { entryId } = await ctx.ble.connect(input.deviceId, 10_000, ctx.signal);
        const restoredSubscriptions = await ctx.ble.restoreSubscriptions(
          input.deviceId,
          ctx.signal,
        );
        return ok(
          `Reconnected after ${attempts} ${attempts === 1 ? 'try' : 'tries'}.`,
          { connected: true, attempts, restoredSubscriptions },
          [entryId],
        );
      } catch {
        ctx.signal.throwIfAborted();
      }
    }
    return fail('CONNECTION_FAILED', `Couldn’t reconnect after ${limit} tries.`);
  },
});
