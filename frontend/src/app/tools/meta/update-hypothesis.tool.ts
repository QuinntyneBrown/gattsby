import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export interface UpdateHypothesisInput {
  readonly protocol: string;
  readonly deviceType?: string;
  readonly maker?: string;
  readonly model?: string;
  readonly proposedConfidence: number;
  readonly evidence: readonly string[];
}

/** Hands a proposal to the hypothesis tracker (ToolContext.hypotheses). */
export interface HypothesisProposer {
  propose(input: UpdateHypothesisInput): { version: number; confidence: number };
  resolves(id: string): boolean;
}

// update_hypothesis (TOOL-028): records a protocol guess. The stored confidence is the
// deterministic score; the proposal's number never sets it (FR-053). The model uses it from
// journey 6; the rules update the hypothesis through the tracker directly.
export const updateHypothesisTool = entry<
  UpdateHypothesisInput,
  { version: number; confidence: number }
>({
  name: 'update_hypothesis',
  group: 'Meta',
  description: 'Record the current protocol guess with the evidence IDs that support it.',
  inputSchema: {
    type: 'object',
    required: ['protocol', 'proposedConfidence', 'evidence'],
    properties: {
      protocol: { type: 'string', maxLength: 80 },
      deviceType: { type: 'string' },
      maker: { type: 'string', maxLength: 80 },
      model: { type: 'string', maxLength: 80 },
      proposedConfidence: { type: 'number', minimum: 0, maximum: 1 },
      evidence: { type: 'array', items: { type: 'string' } },
    },
  },
  outputSchema: { type: 'object' },
  safetyClass: 'n/a',
  preconditions: [],
  stages: ['identify', 'standard', 'proprietary', 'control', 'conclude'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Updating the hypothesis',
    purpose: () => 'Update the hypothesis',
    card: false,
  },
  async run(input, ctx) {
    const tracker = ctx.hypotheses;
    const unknown = input.evidence.filter((id) => !tracker.resolves(id));
    if (unknown.length > 0) {
      return fail('INVALID_INPUT', `Evidence that doesn’t exist: ${unknown.join(', ')}.`);
    }
    const result = tracker.propose(input);
    return ok(`Hypothesis version ${result.version}.`, result);
  },
});
