import type { DecisionState } from '../agent/decision-state';
import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import type { Stage } from '../store/model/stage';
import type { ErrorCode } from './error-code';
import type { SafetyClass, ToolGroup } from './safety-class';
import type { ToolContext } from './tool-context';
import type { ToolResult } from './tool-result';

export interface Precondition {
  readonly id: string;
  readonly check: (ctx: ToolContext) => boolean;
  readonly code: ErrorCode;
  readonly message: string;
}

export interface LabelContext {
  readonly kb: KnowledgeBaseIndex;
  readonly state: DecisionState;
}

// The plain-language labels the person sees for a step (follow-the-investigation design).
export interface ToolLabels<I> {
  /** While it runs: "Reading the maker and model". */
  readonly running: (input: I, ctx: LabelContext) => string;
  /** On its card in the feed: "Read the maker, model and firmware". */
  readonly purpose: (input: I, ctx: LabelContext) => string;
  /** The line under the running step in the dock. */
  readonly detail?: string;
  /** Person tools show as messages and the capability check shows nowhere; others as cards. */
  readonly card: boolean;
}

// One registry entry (FR-070; register-and-list-tools design).
export interface ToolDefinition<I = unknown, O = unknown> {
  readonly name: string;
  readonly group: ToolGroup;
  readonly description: string;
  readonly inputSchema: object;
  readonly outputSchema: object;
  readonly safetyClass: SafetyClass;
  /** Physical prompts and other rule-owned operations may be withheld from the model. */
  readonly modelSelectable?: boolean;
  readonly preconditions: readonly Precondition[];
  readonly stages: readonly Stage[];
  readonly requiredCapabilities: readonly string[];
  readonly phase: 'MVP' | 'P2';
  readonly labels: ToolLabels<I>;
  run(input: I, ctx: ToolContext): Promise<ToolResult<O>>;
}

/** Erases a definition's types for the catalog. */
export function entry<I, O>(definition: ToolDefinition<I, O>): ToolDefinition {
  return definition as unknown as ToolDefinition;
}
