import type { Capabilities } from '../environment/capabilities';
import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import type { Hypothesis } from '../store/model/hypothesis';
import type { Step } from '../store/model/step';
import type { ToolRegistry } from '../tools/tool-registry';
import type { DecisionState } from './decision-state';
import type { RuleOutcome } from './rule-outcome';

export interface ModelDecisionContext {
  readonly outcome: Extract<RuleOutcome, { kind: 'ambiguous' }>;
  readonly state: DecisionState;
  readonly capabilities: Capabilities;
  readonly hypothesis: Hypothesis | null;
  readonly steps: readonly Step[];
  readonly stepBudget: number;
  readonly registry: ToolRegistry;
  readonly kb: KnowledgeBaseIndex;
  resolves(id: string): boolean;
}
