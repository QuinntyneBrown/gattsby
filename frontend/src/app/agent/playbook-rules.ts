import { STAGES, type Stage } from '../store/model/stage';
import { CHECKLIST_LABELS } from './playbook';
import type { RuleAction, RuleOption, RuleOutcome } from './rule-outcome';
import { CONCLUDE_RULES } from './rules/conclude.rules';
import { CONTROL_RULES } from './rules/control.rules';
import { FIND_RULES } from './rules/find.rules';
import { IDENTIFY_RULES } from './rules/identify.rules';
import { PREPARE_RULES } from './rules/prepare.rules';
import { PROPRIETARY_RULES } from './rules/proprietary.rules';
import { STANDARD_RULES } from './rules/standard.rules';
import type { RuleContext, StageRule } from './stage-rule';

const RULES: Readonly<Partial<Record<Stage, readonly StageRule[]>>> = {
  prepare: PREPARE_RULES,
  find: FIND_RULES,
  identify: IDENTIFY_RULES,
  standard: STANDARD_RULES,
  proprietary: PROPRIETARY_RULES,
  control: CONTROL_RULES,
  conclude: CONCLUDE_RULES,
};

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

/** Includes only steps whose playbook rule applies right now. */
export function checklistOptions(outcome: RuleOutcome, ctx: RuleContext): readonly RuleOption[] {
  if (outcome.kind === 'ambiguous') return outcome.options;
  const recommended = checklistOption(outcome.action, true);
  if (!recommended) return [];
  const options = [recommended];
  for (const rule of RULES[outcome.action.stage] ?? []) {
    if (rule.id === outcome.action.ruleId || !rule.when(ctx)) continue;
    const alternative = rule.then(ctx);
    if (alternative.kind !== 'decided') continue;
    const option = checklistOption(alternative.action, false);
    if (option && !options.some((existing) => existing.label === option.label))
      options.push(option);
    if (options.length === 4) break;
  }
  return options;
}

function checklistOption(action: RuleAction, recommended: boolean): RuleOption | null {
  const copy = CHECKLIST_LABELS[action.tool];
  return copy ? { ...copy, action, recommended } : null;
}
