import type { Stage } from '../store/model/stage';

// One action the playbook chose: a tool and its input, with the message the person sees first.
export interface RuleAction {
  readonly tool: string;
  readonly input: Record<string, unknown>;
  readonly ruleId: string;
  readonly stage: Stage;
  readonly message?: { readonly text: string; readonly why?: string };
}

export interface RuleOption {
  readonly action: RuleAction;
  readonly label: string;
  readonly purpose: string;
  readonly recommended: boolean;
}

// What the rules decided (apply-heuristics-first design).
export type RuleOutcome =
  | { readonly kind: 'decided'; readonly action: RuleAction }
  | {
      readonly kind: 'ambiguous';
      readonly ruleId: string;
      readonly stage: Stage;
      readonly options: readonly RuleOption[];
    };
