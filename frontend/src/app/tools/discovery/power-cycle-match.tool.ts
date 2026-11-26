import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';
import { matchByAdvertisements } from './match-by-advertisements';
import { machineWord, scanBehindTap } from './scan';

interface PowerCycleInput {
  readonly candidates?: readonly string[];
  readonly mode: 'guided' | 'automatic';
}

export const powerCycleMatchTool = entry<PowerCycleInput, unknown>({
  name: 'power_cycle_match',
  group: 'Discovery',
  description: 'Tell candidates apart by which device stops advertising and returns.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['mode'],
    properties: {
      mode: { enum: ['guided', 'automatic'] },
      candidates: { type: 'array', maxItems: 8, items: { type: 'string' } },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  modelSelectable: false,
  preconditions: [],
  stages: ['find'],
  requiredCapabilities: ['bluetooth'],
  phase: 'MVP',
  labels: {
    running: () => 'Waiting for the returning device',
    purpose: () => 'Tell the candidates apart by switching the machine off and on',
    card: true,
  },
  async run(input, ctx) {
    if (!ctx.state.advertisementsAvailable) {
      ctx.raiseMissingTool({
        capabilityKey: 'watch-advertisements',
        title: 'Watch Bluetooth advertisements',
        reason: 'This browser does not expose advertisement watching for automatic matching.',
        evidence: [],
      });
    }
    if (input.mode === 'automatic') {
      if (!ctx.state.advertisementsAvailable) {
        return fail('UNSUPPORTED', 'Automatic matching needs advertisement watching.');
      }
      const matched = await matchByAdvertisements(ctx, input.candidates);
      if (!matched) {
        return ok('The advertisements did not identify a single candidate. Try the chooser.', {
          match: null,
          method: 'automatic',
          confidence: 0,
        });
      }
      const name = matched.device.name ?? 'Unnamed device';
      const id = ctx.observe({
        kind: 'candidate-match',
        subject: matched.device.deviceId,
        value: 'automatic',
        text: `${name} stopped advertising and returned.`,
        tag: 'confirmed',
        evidence: matched.evidence,
      });
      return ok(
        `${name} stopped advertising and returned.`,
        {
          match: matched.device.deviceId,
          method: 'automatic',
          confidence: 1,
          device: matched.device,
        },
        [...matched.evidence, id],
      );
    }
    const device = machineWord(ctx.state.machineType);
    const result = await scanBehindTap(
      ctx,
      {
        title: 'Pick the one that comes back',
        detail: `Keep Chrome’s list open. Once the ${device} is stopped, switch it off for about 5 seconds, then on. Pick the name that disappears and comes back.`,
        skippable: true,
      },
      [{ label: 'Find the device', mode: 'filtered' }],
      ctx.state.machineType ?? null,
      ctx.state.brand ?? null,
    );
    if (!result.ok) return result;
    if (!('deviceId' in result.data))
      return fail('INVALID_INPUT', 'Choose the returning device in Chrome.');
    const chosen = result.data;
    const name = chosen.name || 'an unnamed device';
    const evidence = ctx.observe({
      kind: 'candidate-match',
      subject: chosen.deviceId,
      value: 'guided',
      text: `Your machine is ${name}.`,
      tag: 'confirmed',
      evidence: result.evidence,
    });
    return ok(
      `You picked ${name} after it disappeared and came back.`,
      { match: chosen.name ?? chosen.deviceId, method: 'guided', confidence: 1, device: chosen },
      [...result.evidence, evidence],
    );
  },
});
