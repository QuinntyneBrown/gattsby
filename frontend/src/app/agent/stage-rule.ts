import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import type { VerdictFacts } from '../outcome/verdict-builder';
import type { Stage } from '../store/model/stage';
import type { DecisionState } from './decision-state';
import type { LoopConfig } from './loop-config';
import type { RuleOutcome } from './rule-outcome';

export interface RuleContext {
  readonly state: DecisionState;
  readonly kb: KnowledgeBaseIndex;
  readonly config: LoopConfig;
  readonly facts: VerdictFacts;
}

// One deterministic playbook rule (apply-heuristics-first design): the first rule of the current
// stage whose `when` holds decides the next step.
export interface StageRule {
  readonly id: string;
  readonly stage: Stage;
  readonly when: (ctx: RuleContext) => boolean;
  readonly then: (ctx: RuleContext) => RuleOutcome;
}

export function decided(
  id: string,
  stage: Stage,
  tool: string,
  input: Record<string, unknown>,
  message?: { text: string; why?: string },
): RuleOutcome {
  return {
    kind: 'decided',
    action: { tool, input, ruleId: id, stage, ...(message ? { message } : {}) },
  };
}
