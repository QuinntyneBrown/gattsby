import toolInputs from '../../schemas/generated/tool-inputs.js';
import type { Capabilities } from '../environment/capabilities';
import type { Stage } from '../store/model/stage';
import { ToolError } from '../tools/tool-error';
import { capabilityAvailable } from '../tools/tool-list-generator';
import type { ToolRegistry } from '../tools/tool-registry';
import type { DecisionState } from './decision-state';

export function validateToolAction(
  tool: string,
  input: Record<string, unknown>,
  stage: Stage,
  context: {
    registry: ToolRegistry;
    state: DecisionState;
    capabilities: Capabilities;
    resolves(id: string): boolean;
  },
): void {
  const definition = context.registry.get(tool);
  if (!definition) throw new ToolError('UNKNOWN_TOOL', `Unknown tool: ${tool}.`);
  if (!definition.stages.includes(stage))
    throw new ToolError('NOT_ALLOWED_AT_STAGE', `${tool} is not allowed at this stage.`);
  if (
    definition.requiredCapabilities.some((name) => !capabilityAvailable(name, context.capabilities))
  ) {
    throw new ToolError('UNSUPPORTED', `${tool} needs a capability this browser does not have.`);
  }
  if (!toolInputs[tool]?.(input)) {
    throw new ToolError('INVALID_INPUT', `The input for ${tool} is incomplete or invalid.`);
  }
  const inputRefusal = definition.inputPrecondition?.(input, context.state);
  if (inputRefusal) throw new ToolError('PRECONDITION_FAILED', inputRefusal);
  const ids = input['evidence'];
  if (Array.isArray(ids) && ids.some((id: string) => !context.resolves(id))) {
    throw new ToolError('INVALID_INPUT', 'One or more evidence references could not be found.');
  }
}
