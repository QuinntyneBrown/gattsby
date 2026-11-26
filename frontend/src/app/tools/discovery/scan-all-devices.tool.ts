import { entry } from '../tool-definition';
import { scanBehindTap, type ScanOutput } from './scan';

// scan_all_devices (TOOL-003): Chrome's chooser accepting every device (FR-012). Its tap prompt
// also offers "Scan again", which runs the filtered request instead (scan-for-the-device design).
export const scanAllDevicesTool = entry<{ last?: boolean }, ScanOutput>({
  name: 'scan_all_devices',
  group: 'Discovery',
  description: 'Open Chrome’s list of every nearby Bluetooth device, on the person’s tap.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { last: { type: 'boolean' } },
  },
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
  run(input, ctx) {
    return scanBehindTap(
      ctx,
      {
        title: input.last ? 'Check Chrome’s list once more' : 'Not in the list?',
        detail: input.last
          ? 'Look in the full list again now that you have checked the device.'
          : 'Show every nearby Bluetooth device, not just fitness ones, or scan again if the machine was asleep.',
      },
      [
        { label: 'Show all nearby devices', mode: 'acceptAll' },
        ...(!input.last ? [{ label: 'Scan again', mode: 'filtered' as const }] : []),
        ...(!input.last && !ctx.state.powerCycleAttempted
          ? [{ label: 'Several names look alike', mode: 'candidateHelp' as const }]
          : []),
      ],
      ctx.state.machineType ?? null,
      ctx.state.brand ?? null,
    );
  },
});
