import { entry } from '../tool-definition';
import { machineWord, scanBehindTap, type ScanOutput } from './scan';

export interface ScanDevicesInput {
  readonly machineType?: string | null;
  readonly brand?: string | null;
}

// scan_devices (TOOL-002): Chrome's chooser filtered to the knowledge base's known services and
// name prefixes; it opens only on the person's tap (FR-011).
export const scanDevicesTool = entry<ScanDevicesInput, ScanOutput>({
  name: 'scan_devices',
  group: 'Discovery',
  description: 'Open Chrome’s device list filtered to known fitness services, on the person’s tap.',
  inputSchema: {
    type: 'object',
    properties: { machineType: { type: ['string', 'null'] }, brand: { type: ['string', 'null'] } },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [],
  stages: ['find'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: () => 'The scan needs a tap by the person',
    purpose: () => 'Open Chrome’s list of nearby fitness devices',
    card: true,
  },
  run(input, ctx) {
    return scanBehindTap(
      ctx,
      {
        title: 'Find the device',
        detail: `Chrome opens a list of nearby fitness devices. Pick your ${machineWord(
          input.machineType,
        )}, or close the list if you’re not sure.`,
      },
      [{ label: 'Find the device', mode: 'filtered' }],
      input.machineType ?? null,
      input.brand ?? null,
    );
  },
});
