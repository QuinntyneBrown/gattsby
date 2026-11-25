import { STAGES, type Stage } from '../store/model/stage';
import type { RuleOutcome } from './rule-outcome';
import { CONCLUDE_RULES } from './rules/conclude.rules';
import { FIND_RULES } from './rules/find.rules';
import { IDENTIFY_RULES } from './rules/identify.rules';
import { PREPARE_RULES } from './rules/prepare.rules';
import { STANDARD_RULES } from './rules/standard.rules';
import type { RuleContext, StageRule } from './stage-rule';

// The Proprietary path (journey 13) and Control (journey 8) join when they are built.
const RULES: Readonly<Partial<Record<Stage, readonly StageRule[]>>> = {
  prepare: PREPARE_RULES,
  find: FIND_RULES,
  identify: IDENTIFY_RULES,
  standard: STANDARD_RULES,
  conclude: CONCLUDE_RULES,
};

export function isBuiltStage(stage: Stage): boolean {
  return stage in RULES;
}

/**
 * The next step: the first rule of the current stage that applies, moving through the later stages
 * when a stage has nothing left to do (apply-heuristics-first design). Pure. `concludeNow` jumps to
 * Conclude, for an ambiguous step no decider could resolve.
 */
export function nextOutcome(ctx: RuleContext, concludeNow = false): RuleOutcome | null {
  const from = concludeNow ? STAGES.indexOf('conclude') : STAGES.indexOf(ctx.state.stage);
  for (const stage of STAGES.slice(from)) {
    for (const rule of RULES[stage] ?? []) {
      if (rule.when(ctx)) return rule.then(ctx);
    }
  }
  return null;
}
