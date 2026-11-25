import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export interface RequestActionInput {
  readonly instruction: string;
  readonly needsReady: boolean;
  readonly expectedSeconds?: number;
  readonly sequence?: string;
  readonly title?: string;
  readonly steps?: readonly string[];
  readonly why?: string;
  readonly stoppable?: boolean;
  readonly confirmSpeed?: boolean;
}

export interface RequestActionOutput {
  readonly answer: string;
  readonly readyAt?: number;
  readonly doneAt: number;
  readonly skipped: boolean;
}

// request_action (TOOL-026): asks for a physical action and waits for "Done" (FR-051).
export const requestActionTool = entry<RequestActionInput, RequestActionOutput>({
  name: 'request_action',
  group: 'Person',
  description: 'Ask the person to do something physical and wait until they are done.',
  inputSchema: {
    type: 'object',
    required: ['instruction', 'needsReady'],
    properties: {
      instruction: { type: 'string', maxLength: 140 },
      needsReady: { type: 'boolean' },
      expectedSeconds: { type: 'integer', minimum: 5, maximum: 120 },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'n/a',
  preconditions: [],
  stages: ['prepare', 'find', 'identify', 'standard', 'proprietary', 'control', 'conclude'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: { running: (i) => i.title ?? i.instruction, purpose: (i) => i.instruction, card: false },
  async run(input, ctx) {
    if (input.instruction.length === 0 || input.instruction.length > 140) {
      return fail('INVALID_INPUT', 'The instruction must be 1 to 140 characters.');
    }
    if (
      input.expectedSeconds !== undefined &&
      (input.expectedSeconds < 5 || input.expectedSeconds > 120)
    ) {
      return fail('INVALID_INPUT', 'The expected time must be 5 to 120 seconds.');
    }
    const button = input.needsReady ? 'Ready' : 'Done';
    if (ctx.stage === 'standard' && input.confirmSpeed === true) ctx.confirmationCheck.begin();
    const response = await ctx.prompts.post(
      {
        kind: 'action',
        title: input.title ?? input.instruction,
        detail: input.title ? null : null,
        why: input.why ?? null,
        sequence: input.sequence ?? null,
        answers: [button],
        primary: button,
        steps: input.steps ?? [],
        allowFreeText: false,
        needsReady: input.needsReady,
        skippable: !input.stoppable,
        stoppable: !!input.stoppable,
      },
      ctx.signal,
    );
    const id = ctx.observe({
      kind: 'action',
      subject: input.instruction,
      value: response.skipped ? 'skipped' : button.toLowerCase(),
      text: response.skipped ? `Skipped: ${input.instruction}` : `${button}: ${input.instruction}`,
      tag: 'confirmed',
      evidence: [],
    });
    return ok(
      response.skipped ? 'The person skipped it.' : `The person said “${button}”.`,
      {
        answer: button,
        ...(input.needsReady && !response.skipped ? { readyAt: response.respondedAt } : {}),
        doneAt: response.doneAt ?? response.respondedAt,
        skipped: response.skipped,
      },
      [id],
    );
  },
});
