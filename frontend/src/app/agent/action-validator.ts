import validateAction from '../../schemas/generated/agent-action-1.js';
import type { AgentAction } from '../model/agent-action';
import { ToolError } from '../tools/tool-error';
import type { ModelDecisionContext } from './model-decision-context';
import type { RuleAction } from './rule-outcome';
import { validateToolAction } from './validate-tool-action';

export function validateModelAction(candidate: unknown, ctx: ModelDecisionContext): RuleAction {
  if (!validateAction(candidate)) {
    throw new ToolError('INVALID_INPUT', 'The model must return one valid JSON action.');
  }
  const proposed = candidate as AgentAction;
  const { tool, input, why } = actionInput(proposed);
  const definition = ctx.registry.get(tool);
  if (!definition) throw new ToolError('UNKNOWN_TOOL', `Unknown tool: ${tool}.`);
  if (!definition.stages.includes(ctx.outcome.stage) || definition.modelSelectable === false) {
    throw new ToolError('NOT_ALLOWED_AT_STAGE', `${tool} is not allowed at this stage.`);
  }
  if (definition.safetyClass === 'write' || definition.safetyClass === 'control') {
    throw new ToolError(
      'APPROVAL_REQUIRED',
      'Only the person may approve a write or control call.',
    );
  }
  validateToolAction(tool, input, ctx.outcome.stage, ctx);
  if (
    tool === 'update_hypothesis' &&
    !ctx.outcome.options.some(
      (option) =>
        option.action.tool === tool && option.action.input['protocol'] === input['protocol'],
    )
  ) {
    throw new ToolError(
      'PRECONDITION_FAILED',
      'The protocol is not supported by the current observations.',
    );
  }
  return {
    tool,
    input,
    stage: ctx.outcome.stage,
    ruleId: ctx.outcome.ruleId,
    ...(why ? { message: { text: 'The agent chose the next step.', why } } : {}),
  };
}

function actionInput(action: AgentAction): {
  tool: string;
  input: Record<string, unknown>;
  why?: string;
} {
  if (action.type === 'call_tool') return action;
  if (action.type === 'ask_user') {
    const { type, why, ...input } = action;
    return { tool: type, input, why };
  }
  const { type, ...input } = action;
  return { tool: type, input };
}
