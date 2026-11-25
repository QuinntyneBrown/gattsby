import { Injectable } from '@angular/core';
import type { RuleAction, RuleOutcome } from './rule-outcome';

// Resolves an ambiguous step (apply-heuristics-first design): the model in full agent mode
// (journey 6), the person in checklist mode (journey 7). `null` means nobody can choose, and the
// orchestrator concludes with what is known.
export abstract class Decider {
  abstract decide(outcome: Extract<RuleOutcome, { kind: 'ambiguous' }>): Promise<RuleAction | null>;
}

// Until the model and checklist deciders exist, an ambiguous step concludes the investigation.
@Injectable()
export class ConcludeDecider extends Decider {
  async decide(): Promise<RuleAction | null> {
    return null;
  }
}
