import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export const decodeStandardTool = entry<
  { readonly doneAt: number },
  { readonly confirmed: boolean }
>({
  name: 'decode_standard',
  group: 'Analysis',
  description: 'Compare standard notifications before and after the person takes an action.',
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
    running: () => 'Checking whether the reading changed',
    purpose: () => 'Compare the readings before and after your change',
    detail: 'Gattsby checks the readings for up to 15 seconds.',
    card: true,
  },
  async run(input, ctx) {
    if (!Number.isFinite(input.doneAt)) return fail('INVALID_INPUT', 'The action time is missing.');
    const { metric, baseline, qualifying, startedAt, baselineDistance, distance } =
      await ctx.confirmationCheck.finish(input.doneAt, ctx.ble, ctx.signal);
    const confirmed = !!(baseline && qualifying && startedAt !== null);
    const label = metric === 'speed' ? 'Speed' : 'Heart rate';
    const unit = metric === 'speed' ? 'km/h' : 'BPM';
    const precision = metric === 'speed' ? 1 : 0;
    const summary = confirmed
      ? `${label} went from ${baseline.value.toFixed(precision)} to ${qualifying.value.toFixed(precision)} ${unit} within ${Math.ceil((qualifying.t - startedAt) / 1000)} s.`
      : `${label} did not move enough to confirm it.`;
    const observation = ctx.observe({
      kind: confirmed ? 'metric-confirmed' : 'metricConfirmation',
      subject: metric,
      value: confirmed ? 'confirmed' : 'notConfirmed',
      text: confirmed ? `${label}: ${qualifying.value.toFixed(precision)} ${unit}` : summary,
      tag: confirmed ? 'confirmed' : 'likely',
      evidence: [baseline?.rawLogId, qualifying?.rawLogId].filter((id) => id !== undefined),
    });
    const evidence = [observation];
    if (baselineDistance && distance) {
      evidence.push(
        ctx.observe({
          kind: 'metric-confirmed',
          subject: 'distance',
          value: 'confirmed',
          text: `Distance: ${distance.value} m`,
          tag: 'confirmed',
          evidence: [baselineDistance.rawLogId, distance.rawLogId],
        }),
      );
    }
    return ok(summary, { confirmed }, evidence);
  },
});
