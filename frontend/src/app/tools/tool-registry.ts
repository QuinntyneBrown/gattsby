import type { Stage } from '../store/model/stage';
import type { ToolDefinition } from './tool-definition';

const NAME = /^[a-z][a-z0-9_]*$/;
const PERSON_OR_META = new Set(['Person', 'Meta']);

// The registry built from the catalog (register-and-list-tools design). It refuses to start when an
// entry breaks an invariant, naming the tool and the field.
export class ToolRegistry {
  private readonly byName = new Map<string, ToolDefinition>();

  constructor(
    catalog: readonly ToolDefinition[],
    private readonly enabledPhases: readonly ('MVP' | 'P2')[] = ['MVP'],
  ) {
    for (const tool of catalog) {
      const broken = invariantBroken(tool);
      if (broken) throw new Error(`Tool registry: ${tool.name || '(unnamed)'}: ${broken}`);
      if (this.byName.has(tool.name))
        throw new Error(`Tool registry: ${tool.name}: name is not unique`);
      this.byName.set(tool.name, tool);
    }
  }

  get(name: string): ToolDefinition | undefined {
    const tool = this.byName.get(name);
    return tool && this.enabledPhases.includes(tool.phase) ? tool : undefined;
  }

  all(): ToolDefinition[] {
    return [...this.byName.values()].filter((t) => this.enabledPhases.includes(t.phase));
  }

  forStage(stage: Stage): ToolDefinition[] {
    return this.all().filter((t) => t.stages.includes(stage));
  }
}

function invariantBroken(tool: ToolDefinition): string | null {
  if (!NAME.test(tool.name)) return 'name must be snake case';
  if (!tool.description || tool.description.includes('\n') || tool.description.length > 120) {
    return 'description must be one line of at most 120 characters';
  }
  if (!tool.inputSchema || !tool.outputSchema) return 'inputSchema and outputSchema are required';
  if (tool.safetyClass === 'n/a' && !PERSON_OR_META.has(tool.group)) {
    return 'safetyClass n/a belongs only to Person and Meta tools';
  }
  if (tool.safetyClass === 'control' && tool.stages.some((s) => s !== 'control')) {
    return 'a control tool lists only the control stage';
  }
  if (tool.safetyClass === 'write' && tool.stages.some((s) => s !== 'proprietary')) {
    return 'a write tool lists only the proprietary stage';
  }
  if (!tool.labels) return 'labels are required';
  return null;
}
