import { inject, Injectable } from '@angular/core';
import { ToolError } from '../tools/tool-error';
import { PromptChannel } from './prompt-channel';
import type { RuleAction, RuleOption } from './rule-outcome';

@Injectable()
export class ChecklistDecider {
  private readonly prompts = inject(PromptChannel);

  async decide(
    options: readonly RuleOption[],
    validate: (action: RuleAction) => void,
    signal: AbortSignal,
  ): Promise<RuleAction | null> {
    const shown = [...options]
      .sort((a, b) => Number(b.recommended) - Number(a.recommended))
      .slice(0, 4);
    const recommended = shown[0];
    if (!recommended) return null;
    let explanation: string | null = null;
    while (!signal.aborted) {
      const answer = await this.prompts
        .post(
          {
            kind: 'checklist',
            title: 'Pick the next step',
            detail: explanation ?? `Recommended: ${recommended.label}. ${recommended.purpose}`,
            why: null,
            sequence: null,
            answers: shown.map((option) => option.label),
            primary: null,
            steps: [],
            allowFreeText: false,
            needsReady: false,
            skippable: false,
            stoppable: false,
          },
          signal,
        )
        .catch((error: unknown) => {
          if (signal.aborted) return null;
          throw error;
        });
      if (!answer) return null;
      const selected = shown.find((option) => option.label === answer.answer);
      if (!selected) {
        explanation = 'Choose one of the available steps.';
        continue;
      }
      try {
        validate(selected.action);
        return selected.action;
      } catch (error) {
        if (!(error instanceof ToolError)) throw error;
        explanation = error.message;
      }
    }
    return null;
  }
}
