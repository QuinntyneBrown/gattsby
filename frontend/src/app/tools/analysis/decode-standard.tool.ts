import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export const decodeStandardTool = entry<
  { readonly doneAt: number },
  { readonly confirmed: boolean }
>({
  name: 'decode_standard',
  group: 'Analysis',
  description: 'Compare standard speed notifications before and after the person changes speed.',
  inputSchema: {
    type: 'object',
    required: ['doneAt'],
    properties: { doneAt: { type: 'number' } },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  preconditions: [],
  stages: ['standard'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Checking whether speed changed',
    purpose: () => 'Compare speed before and after your change',
    detail: 'Gattsby checks the readings for up to 15 seconds.',
    card: true,
  },
  async run(input, ctx) {
    if (!Number.isFinite(input.doneAt)) return fail('INVALID_INPUT', 'The action time is missing.');
    const { baseline, qualifying, startedAt } = await ctx.confirmationCheck.finish(
      input.doneAt,
      ctx.ble,
      ctx.signal,
    );
    const confirmed = !!(baseline && qualifying && startedAt !== null);
    const summary = confirmed
      ? `Speed went from ${baseline.value.toFixed(1)} to ${qualifying.value.toFixed(1)} km/h within ${Math.ceil((qualifying.t - startedAt) / 1000)} s.`
      : 'Speed did not move enough to confirm it.';
    const observation = ctx.observe({
      kind: 'metricConfirmation',
      subject: 'speed',
      value: confirmed ? 'confirmed' : 'notConfirmed',
      text: summary,
      tag: confirmed ? 'confirmed' : 'likely',
      evidence: [baseline?.rawLogId, qualifying?.rawLogId].filter((id) => id !== undefined),
    });
    return ok(summary, { confirmed }, [observation]);
  },
});
