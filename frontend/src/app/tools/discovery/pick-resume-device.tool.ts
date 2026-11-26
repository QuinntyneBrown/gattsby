import { ScanOptionsBuilder } from '../../ble/scan-options-builder';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export const pickResumeDeviceTool = entry<{ retry?: boolean }, { deviceId: string }>({
  name: 'pick_resume_device',
  group: 'Discovery',
  description: 'Ask the person to select the same device again in Chrome.',
  inputSchema: {
    type: 'object',
    properties: { retry: { type: 'boolean' } },
    additionalProperties: false,
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  modelSelectable: false,
  preconditions: [],
  stages: ['identify', 'standard', 'proprietary', 'control'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: () => 'Waiting for the same device',
    purpose: () => 'Choose the saved device again',
    card: true,
  },
  async run({ retry }, ctx) {
    const saved = ctx.state.device;
    if (!saved) return fail('PRECONDITION_FAILED', 'No device is saved for this investigation.');
    const request = new ScanOptionsBuilder(ctx.kb).acceptAll();
    const services = (ctx.state.layout ?? [])
      .map(({ uuid }) => uuid)
      .filter((uuid) => !ctx.kb.isBlocklisted(uuid, 'all'));
    const options = {
      ...request.options,
      optionalServices: [...new Set([...(request.options.optionalServices ?? []), ...services])],
    };
    await ctx.prompts.post(
      {
        kind: 'tap',
        title: 'Find the device again',
        detail: [
          retry
            ? 'Chrome has not selected the saved device yet.'
            : 'Chrome needs you to choose the device again.',
          saved.name
            ? `Select ${saved.name} to continue this investigation.`
            : 'Select the same device to continue this investigation.',
        ].join(' '),
        why: null,
        sequence: null,
        answers: ['Find the device'],
        primary: 'Find the device',
        steps: [],
        allowFreeText: false,
        needsReady: false,
        skippable: false,
        stoppable: true,
      },
      ctx.signal,
    );
    ctx.signal.throwIfAborted();
    const device = await ctx.ble.requestDevice({ ...request, options });
    if (device.deviceId !== saved.deviceId)
      return fail('PRECONDITION_FAILED', 'That is a different device. Choose the saved device.');
    return ok('Selected the same device.', { deviceId: device.deviceId });
  },
});
