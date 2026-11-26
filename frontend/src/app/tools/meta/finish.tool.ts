import { checkVerdict, verdictLabel } from '../../outcome/verdict-builder';
import type { VerdictKind } from '../../store/model/verdict';
import { shortUuid } from '../../knowledge-base/uuid';
import type { ToolContext } from '../tool-context';
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
    let facts = ctx.verdictFacts();
    if (input.verdict === 'needsMissingTool' && facts.missingToolRequests.length === 0) {
      raiseWhatBlocked(ctx);
      facts = ctx.verdictFacts();
    }
    const check = checkVerdict(input.verdict, facts);
    if (!check.supported) return fail('PRECONDITION_FAILED', check.missing);
    const label = verdictLabel(input.verdict, facts.hypothesis?.protocol ?? null);
    const evidence =
      input.verdict === 'notConnectable'
        ? facts.observations
            .filter(({ kind }) => kind === 'reachability')
            .flatMap(({ id, evidence }) => [id, ...evidence])
        : [];
    return ok(`${label}.`, { verdict: input.verdict, label, profileId: null }, evidence);
  },
});

/**
 * A connected device with nothing decoded supports no verdict, so the request that blocked it is
 * raised: one per service the knowledge base doesn't know, or else one for the protocol itself
 * (issue-the-verdict design, rule 5).
 */
function raiseWhatBlocked(ctx: ToolContext): void {
  const unknown = (ctx.state.layout ?? []).filter((s) => !ctx.kb.nameOf(s.uuid));
  for (const service of unknown) {
    ctx.raiseMissingTool({
      capabilityKey: `decode-service:${service.uuid}`,
      title: `Decode service ${shortUuid(service.uuid)}`,
      reason: 'The service isn’t in the knowledge base, so Gattsby has no decoder for its data.',
      evidence: [],
    });
  }
  if (unknown.length === 0) {
    ctx.raiseMissingTool({
      capabilityKey: 'identify-protocol',
      title: 'Identify this device’s protocol',
      reason:
        'The investigation ended before any field was decoded, and nothing it read names a protocol Gattsby knows.',
      evidence: [],
    });
  }
}
