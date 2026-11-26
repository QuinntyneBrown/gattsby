import type { AdvertisementSample } from '../../store/model/advertisement-sample';
import { entry } from '../tool-definition';
import { ToolError } from '../tool-error';
import { fail, ok } from '../tool-result';
import { waitForAdvertisements } from './advertisement-window';

export const watchAdvertisementsTool = entry<
  { deviceId: string; seconds: number },
  { samples: readonly AdvertisementSample[]; count: number }
>({
  name: 'watch_advertisements',
  group: 'Discovery',
  description: 'Capture advertisement details for a permitted device for up to one minute.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['deviceId', 'seconds'],
    properties: {
      deviceId: { type: 'string' },
      seconds: { type: 'integer', minimum: 1, maximum: 60 },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [],
  stages: ['find'],
  requiredCapabilities: ['advertisements'],
  phase: 'P2',
  labels: {
    running: () => 'Watching Bluetooth advertisements',
    purpose: () => 'Read Bluetooth advertisements',
    card: true,
  },
  async run(input, ctx) {
    if (!ctx.state.advertisementsAvailable) {
      ctx.raiseMissingTool({
        capabilityKey: 'watch-advertisements',
        title: 'Watch Bluetooth advertisements',
        reason: 'This browser does not expose advertisement watching.',
        evidence: [],
      });
      return fail('UNSUPPORTED', 'This browser cannot watch Bluetooth advertisements.');
    }
    if (!Number.isInteger(input.seconds) || input.seconds < 1 || input.seconds > 60)
      return fail('INVALID_INPUT', 'Choose a watch window of 1 to 60 seconds.');
    if (!(await ctx.ble.permittedDevices()).some(({ deviceId }) => deviceId === input.deviceId)) {
      return fail('PRECONDITION_FAILED', 'Choose the device in Chrome before watching it.');
    }
    const answer = await ctx.prompts.post(
      {
        kind: 'tap',
        title: 'Watch the device',
        detail: 'Capture its Bluetooth advertisements on this device.',
        why: null,
        sequence: null,
        answers: ['Start watching'],
        primary: 'Start watching',
        steps: [],
        allowFreeText: false,
        needsReady: false,
        skippable: true,
        stoppable: false,
      },
      ctx.signal,
    );
    if (answer.skipped) return fail('USER_CANCELLED', 'The person skipped advertisement watching.');
    const watch = new AbortController();
    const abort = () => watch.abort();
    ctx.signal.addEventListener('abort', abort, { once: true });
    if (ctx.signal.aborted) abort();
    const samples: AdvertisementSample[] = [];
    let count = 0;
    try {
      const ready = ctx.ble.watchAdvertisements(
        [input.deviceId],
        (sample) => {
          count++;
          if (samples.length < 120) samples.push(sample);
        },
        watch.signal,
      );
      await Promise.race([
        ready,
        waitForAdvertisements(ctx.clock, 5_000, watch.signal).then(() => {
          throw new ToolError('TIMEOUT', 'The browser did not start the advertisement watch.');
        }),
      ]);
      await waitForAdvertisements(ctx.clock, input.seconds * 1_000, watch.signal);
    } finally {
      abort();
      ctx.signal.removeEventListener('abort', abort);
    }
    const ids = samples.map((sample) => sample.evidenceId);
    return ok(`${count} advertisements received.`, { samples, count }, ids);
  },
});
