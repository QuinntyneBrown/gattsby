import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

const CONFIRMATION_MS = 15_000;
const EPSILON = 1e-6;

export const checkCommandEffectTool = entry<Record<string, never>, unknown>({
  name: 'check_command_effect',
  group: 'Control',
  description:
    'Check whether the approved command matches the live readings and the person’s answer.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  modelSelectable: false,
  preconditions: [],
  stages: ['control'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Checking the effect of the command',
    purpose: () => 'Check the effect of the command',
    card: true,
  },
  async run(_input, ctx) {
    const test = ctx.state.controlTest;
    if (!test) return fail('PRECONDITION_FAILED', 'There is no accepted command to check.');
    const samples = ctx.controlTelemetry
      .samples(test.metric, test.sentAt)
      .filter((sample) => sample.t <= test.sentAt + CONFIRMATION_MS);
    const direction = Math.sign(test.to - test.from);
    const opposite = samples.find((sample) => direction * (sample.value - test.from) < -EPSILON);
    const target = samples.find((sample) => Math.abs(sample.value - test.to) < EPSILON);
    const confirmed = !opposite && target && ctx.state.controlAnswer?.startsWith('Yes');
    const status = opposite ? 'opposite' : confirmed ? 'confirmed' : 'notSeen';
    const relevant = opposite ?? target;
    const evidence = [test.baselineId, ...(relevant ? [relevant.rawLogId] : [])];
    const summary = opposite
      ? 'The live value changed in the opposite direction.'
      : confirmed
        ? 'The person and the live readings confirmed the change.'
        : 'The command was accepted. Its effect has not been confirmed.';
    const id = ctx.observe({
      kind: 'control-effect',
      subject: test.metric,
      value: status,
      text: summary,
      tag: status === 'notSeen' ? 'likely' : 'confirmed',
      evidence,
    });
    return ok(summary, { status, from: test.from, to: test.to }, [...evidence, id]);
  },
});
