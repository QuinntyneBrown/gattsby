import { checkVerdict, verdictLabel } from '../../outcome/verdict-builder';
import type { VerdictKind } from '../../store/model/verdict';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export interface FinishInput {
  readonly verdict: VerdictKind;
  readonly summary: string;
}

const KINDS: readonly VerdictKind[] = [
  'connected',
  'partiallyDecoded',
  'needsMissingTool',
  'notConnectable',
  'stoppedByPerson',
];

// finish (TOOL-030): issues the verdict once the evidence supports it (FR-054). The orchestrator
// commits it with the final step and releases the connection (issue-the-verdict design).
export const finishTool = entry<
  FinishInput,
  { verdict: VerdictKind; label: string; profileId: null }
>({
  name: 'finish',
  group: 'Meta',
  description: 'Issue the verdict the evidence supports, with a one-paragraph summary.',
  inputSchema: {
    type: 'object',
    required: ['verdict', 'summary'],
    properties: {
      verdict: { enum: KINDS },
      summary: { type: 'string', maxLength: 280 },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'n/a',
  preconditions: [],
  stages: ['conclude'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Building the verdict',
    purpose: () => 'Issue the verdict',
    card: false,
  },
  async run(input, ctx) {
    if (!KINDS.includes(input.verdict) || input.summary.length > 280) {
      return fail('INVALID_INPUT', 'Name a verdict and give a summary of at most 280 characters.');
    }
    const facts = ctx.verdictFacts();
    const check = checkVerdict(input.verdict, facts);
    if (!check.supported) return fail('PRECONDITION_FAILED', check.missing);
    const label = verdictLabel(input.verdict, facts.hypothesis?.protocol ?? null);
    return ok(`${label}.`, { verdict: input.verdict, label, profileId: null });
  },
});
