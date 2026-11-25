import { entry } from '../tool-definition';
import { ToolError } from '../tool-error';
import { fail, ok } from '../tool-result';

export interface ConnectInput {
  readonly deviceId: string;
  readonly timeoutMs?: number;
}

// connect (TOOL-006): connects to the chosen device's GATT server (FR-015). Never writes, pairs or
// changes a setting (NFR-019).
export const connectTool = entry<ConnectInput, { connected: true; at: number }>({
  name: 'connect',
  group: 'Connection',
  description: 'Connect to the chosen device and watch for disconnects.',
  inputSchema: {
    type: 'object',
    required: ['deviceId'],
    properties: {
      deviceId: { type: 'string' },
      timeoutMs: { type: 'integer', minimum: 1000, maximum: 20000 },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [
    {
      id: 'deviceChosen',
      check: (ctx) => ctx.state.device !== null,
      code: 'PRECONDITION_FAILED',
      message: 'No device has been chosen in this investigation.',
    },
  ],
  stages: ['identify'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: (_i, { state }) => `Connecting to ${state.device?.name ?? 'the device'}`,
    purpose: (_i, { state }) => `Connect to ${state.device?.name ?? 'the device'}`,
    detail: 'Read-only, takes a few seconds. Nothing for you to do.',
    card: true,
  },
  async run(input, ctx) {
    const timeout = input.timeoutMs ?? 10_000;
    if (timeout < 1000 || timeout > 20_000) {
      return fail('INVALID_INPUT', 'The time limit must be 1 to 20 seconds.');
    }
    try {
      const { at, entryId } = await ctx.ble.connect(input.deviceId, timeout);
      const id = ctx.observe({
        kind: 'connected',
        subject: input.deviceId,
        value: 'connected',
        text: 'Connected',
        tag: 'confirmed',
        evidence: [entryId],
      });
      return ok('Connected.', { connected: true, at }, [entryId, id]);
    } catch (error) {
      if (error instanceof ToolError && error.code === 'CONNECTION_FAILED') {
        const id = ctx.observe({
          kind: 'held-by-other',
          subject: input.deviceId,
          value: String(ctx.state.connectFailures + 1),
          text: 'Another app or watch may be holding the connection',
          tag: 'likely',
          evidence: [],
        });
        return fail(
          'CONNECTION_FAILED',
          error.message,
          `The ${ctx.state.machineType ? 'machine' : 'device'} refused the connection.`,
          [id],
        );
      }
      throw error;
    }
  },
});
