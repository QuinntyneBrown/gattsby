import { entry } from '../tool-definition';
import { ok } from '../tool-result';

// disconnect (TOOL-008): stops every notification and disconnects. Idempotent; never fails.
export const disconnectTool = entry<{ deviceId?: string }, { disconnected: true }>({
  name: 'disconnect',
  group: 'Connection',
  description: 'Stop every notification and disconnect.',
  inputSchema: { type: 'object', properties: { deviceId: { type: 'string' } } },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [],
  stages: ['find', 'identify', 'standard', 'proprietary', 'control', 'conclude'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: { running: () => 'Disconnecting', purpose: () => 'Disconnect', card: false },
  async run(_input, ctx) {
    await ctx.ble.disconnect();
    return ok('Disconnected.', { disconnected: true });
  },
});
