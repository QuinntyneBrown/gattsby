import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';
import type { AgentAction } from '../../model/agent-action';
import { STAGES } from '../../store/model/stage';
import { missingToolKey } from '../../outcome/merge-missing-tool-requests';

type RequestInput = Omit<Extract<AgentAction, { type: 'request_missing_tool' }>, 'type'>;

export const requestMissingTool = entry<RequestInput, { requestId: string; merged: boolean }>({
  name: 'request_missing_tool',
  group: 'Meta',
  description: 'Record a capability the agent lacks, with the supporting evidence IDs.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['capability', 'reason', 'evidence'],
    properties: {
      capability: { type: 'string', minLength: 1, maxLength: 80 },
      reason: { type: 'string', minLength: 1, maxLength: 280 },
      evidence: {
        type: 'array',
        maxItems: 24,
        items: { type: 'string', minLength: 1, maxLength: 128 },
      },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['requestId', 'merged'],
    properties: { requestId: { type: 'string' }, merged: { type: 'boolean' } },
  },
  safetyClass: 'n/a',
  preconditions: [],
  stages: STAGES,
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Recording a missing tool',
    purpose: () => 'Record a missing tool',
    card: true,
  },
  async run(input, ctx) {
    const title = input.capability.trim();
    const reason = input.reason.trim();
    const capabilityKey = missingToolKey(title);
    if (!capabilityKey || !reason || input.evidence.some((id) => !ctx.hypotheses.resolves(id))) {
      return fail(
        'INVALID_INPUT',
        'A missing-tool request needs a name, a reason and valid evidence.',
      );
    }
    const merged = ctx
      .verdictFacts()
      .missingToolRequests.some((item) => missingToolKey(item.capabilityKey) === capabilityKey);
    const requestId = ctx.raiseMissingTool({
      capabilityKey,
      title,
      reason,
      evidence: input.evidence,
      source: 'agent',
    });
    return ok(merged ? 'Missing tool already recorded.' : 'Missing tool recorded.', {
      requestId,
      merged,
    });
  },
});
