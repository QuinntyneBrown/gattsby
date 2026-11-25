import { entry } from '../tool-definition';
import { scanBehindTap, type ScanOutput } from './scan';

// scan_all_devices (TOOL-003): Chrome's chooser accepting every device (FR-012). Its tap prompt
// also offers "Scan again", which runs the filtered request instead (scan-for-the-device design).
export const scanAllDevicesTool = entry<Record<string, never>, ScanOutput>({
  name: 'scan_all_devices',
  group: 'Discovery',
  description: 'Open Chrome’s list of every nearby Bluetooth device, on the person’s tap.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [
    {
      id: 'scannedFirst',
      check: (ctx) => ctx.state.scans.length > 0,
      code: 'PRECONDITION_FAILED',
      message: 'scan_devices must run first in this investigation.',
    },
  ],
  stages: ['find'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: () => 'The scan needs a tap by the person',
    purpose: () => 'Open Chrome’s list of every nearby Bluetooth device',
    card: true,
  },
  run(_input, ctx) {
    return scanBehindTap(
      ctx,
      {
        title: 'Not in the list?',
        detail:
          'Show every nearby Bluetooth device, not just fitness ones, or scan again if the machine was asleep.',
      },
      [
        { label: 'Show all nearby devices', mode: 'acceptAll' },
        { label: 'Scan again', mode: 'filtered' },
      ],
      ctx.state.machineType ?? null,
      ctx.state.brand ?? null,
    );
  },
});
