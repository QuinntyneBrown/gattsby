import { entry } from '../tool-definition';
import { ok } from '../tool-result';

export const reportCandidateNamesTool = entry<Record<string, never>, unknown>({
  name: 'report_candidate_names',
  group: 'Person',
  description: 'Record any look-alike names the person remembers from Chrome’s chooser.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
  safetyClass: 'n/a',
  modelSelectable: false,
  preconditions: [],
  stages: ['find'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Waiting for candidate names',
    purpose: () => 'Names reported by the person',
    card: true,
  },
  async run(_input, ctx) {
    const response = await ctx.prompts.post(
      {
        kind: 'question',
        title: 'Which names look alike?',
        detail: 'If you remember them, enter the names separated by commas.',
        why: null,
        sequence: null,
        answers: ['Continue without the names'],
        primary: null,
        steps: [],
        allowFreeText: true,
        needsReady: false,
        skippable: false,
        stoppable: false,
      },
      ctx.signal,
    );
    const names = [
      ...new Set(
        (response.freeText ?? '')
          .split(/[,\r\n]+/)
          .map((name) => Array.from(name.trim()).slice(0, 80).join(''))
          .filter(Boolean),
      ),
    ].slice(0, 8);
    const evidence = names.map((name) =>
      ctx.observe({
        kind: 'reported-candidate',
        subject: name,
        value: name,
        text: name,
        tag: 'guess',
        evidence: [],
      }),
    );
    const summary = names.length
      ? `${names.length} names reported by the person.`
      : 'The person continued without reporting names.';
    return ok(summary, { names }, evidence);
  },
});
