import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export const getPermittedDevicesTool = entry<
  Record<string, never>,
  { devices: { deviceId: string; name: string | null }[] }
>({
  name: 'get_permitted_devices',
  group: 'Discovery',
  description: 'List devices Chrome has already allowed Gattsby to access.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  modelSelectable: false,
  preconditions: [],
  stages: ['find', 'identify', 'standard', 'proprietary', 'control'],
  requiredCapabilities: ['getDevices'],
  phase: 'P2',
  labels: {
    running: () => 'Checking previous device permissions',
    purpose: () => 'Find the device Chrome already permitted',
    card: true,
  },
  async run(_input, ctx) {
    if (!(await ctx.ble.availability()).getDevices)
      return fail('UNSUPPORTED', 'Chrome needs you to choose the device again.');
    try {
      const devices = (await ctx.ble.permittedDevices()).map(({ deviceId, name }) => ({
        deviceId,
        name,
      }));
      return ok('Checked the devices previously allowed in Chrome.', { devices });
    } catch {
      return fail('UNSUPPORTED', 'Chrome could not retrieve previous device permissions.');
    }
  },
});
