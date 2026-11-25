import type { Capabilities } from '../../environment/capabilities';
import { entry } from '../tool-definition';
import { ok } from '../tool-result';

// check_capabilities (TOOL-001): what this browser and platform can do. Never fails.
export const checkCapabilitiesTool = entry<Record<string, never>, Capabilities>({
  name: 'check_capabilities',
  group: 'Environment',
  description: 'Report which browser capabilities Gattsby can use here.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [],
  stages: ['prepare'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Checking what this browser can do',
    purpose: () => 'Check what this browser can do',
    card: false,
  },
  async run(_input, ctx) {
    const capabilities = await ctx.capabilities.detect();
    const missing = [
      !capabilities.bluetooth.api && 'Web Bluetooth',
      capabilities.bluetooth.api && !capabilities.bluetooth.adapterAvailable && 'Bluetooth adapter',
      capabilities.model.availability !== 'available' && 'on-device model',
      !capabilities.watchAdvertisements && 'advertisement scanning',
      !capabilities.camera && 'camera',
      !capabilities.storage.open && 'storage',
    ].filter((item): item is string => !!item);
    const id = ctx.observe({
      kind: 'capabilities',
      subject: 'browser',
      value: missing.join(',') || 'all',
      text: missing.length
        ? `Not available: ${missing.join(', ')}`
        : 'Every capability is available',
      tag: 'confirmed',
      evidence: [],
    });
    return ok(
      missing.length ? `Not available: ${missing.join(', ')}.` : 'Every capability is available.',
      capabilities,
      [id],
    );
  },
});
