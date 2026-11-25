import { DONT_KNOW } from '../../agent/decision-state';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export interface AskUserInput {
  readonly question: string;
  readonly answers: readonly string[];
  readonly allowFreeText?: boolean;
  /** Set by the playbook: "Question 1 of 3". */
  readonly sequence?: string;
  readonly detail?: string;
}

export interface AskUserOutput {
  readonly answer: string;
  readonly freeText?: string;
  readonly skipped: boolean;
}

export const FREE_TEXT_LIMIT = 500;

export type AskUserCheck =
  | { readonly valid: true; readonly answers: readonly string[] }
  | { readonly valid: false; readonly message: string };

/** Refuses what TOOL-025 limits, and adds "Don't know" when it is missing. Pure. */
export function checkAskUser(input: AskUserInput): AskUserCheck {
  if (input.question.length === 0 || input.question.length > 140) {
    return { valid: false, message: 'The question must be 1 to 140 characters.' };
  }
  if (input.answers.length < 2 || input.answers.length > 6) {
    return { valid: false, message: 'Give 2 to 6 answers.' };
  }
  if (input.answers.some((a) => a.length === 0 || a.length > 40)) {
    return { valid: false, message: 'Each answer must be 1 to 40 characters.' };
  }
  const answers = input.answers.includes(DONT_KNOW) ? input.answers : [...input.answers, DONT_KNOW];
  return { valid: true, answers };
}

// ask_user (TOOL-025): one question with suggested answers and "Don't know" (FR-050).
export const askUserTool = entry<AskUserInput, AskUserOutput>({
  name: 'ask_user',
  group: 'Person',
  description: 'Ask the person one question with 2 to 6 suggested answers.',
  inputSchema: {
    type: 'object',
    required: ['question', 'answers'],
    properties: {
      question: { type: 'string', maxLength: 140 },
      answers: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        items: { type: 'string', maxLength: 40 },
      },
      allowFreeText: { type: 'boolean' },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'n/a',
  preconditions: [],
  stages: ['prepare', 'find', 'identify', 'standard', 'proprietary', 'control', 'conclude'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: { running: (i) => i.question, purpose: (i) => i.question, card: false },
  async run(input, ctx) {
    const check = checkAskUser(input);
    if (!check.valid) return fail('INVALID_INPUT', check.message);
    const answers = check.answers;
    const response = await ctx.prompts.post(
      {
        kind: 'question',
        title: input.question,
        detail: input.detail ?? null,
        why: null,
        sequence: input.sequence ?? null,
        answers,
        primary: null,
        steps: [],
        allowFreeText: !!input.allowFreeText,
        needsReady: false,
        skippable: true,
        stoppable: false,
      },
      ctx.signal,
    );
    const freeText = response.freeText?.slice(0, FREE_TEXT_LIMIT);
    const answer = response.skipped ? 'Skipped' : (freeText ?? response.answer);
    const id = ctx.observe({
      kind: 'answer',
      subject: input.question,
      value: answer,
      text: response.skipped ? `Skipped: ${input.question}` : `${input.question} ${answer}`,
      tag: 'confirmed',
      evidence: [],
    });
    return ok(
      response.skipped ? 'The person skipped the question.' : `The person answered “${answer}”.`,
      {
        answer,
        ...(freeText !== undefined ? { freeText } : {}),
        skipped: response.skipped,
      },
      [id],
    );
  },
});
