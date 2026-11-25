export type PromptKind = 'question' | 'checklist' | 'action' | 'approval' | 'tap' | 'photo';

// One prompt in the dock (ask-the-person design).
export interface PersonPrompt {
  readonly id: string;
  readonly kind: PromptKind;
  readonly title: string;
  readonly detail: string | null;
  readonly why: string | null;
  /** "Question 1 of 3", where the prompt is one of a counted series. */
  readonly sequence: string | null;
  readonly answers: readonly string[];
  /** Answers drawn as large buttons rather than reply chips (tap and action prompts). */
  readonly primary: string | null;
  readonly steps: readonly string[];
  readonly allowFreeText: boolean;
  readonly needsReady: boolean;
  readonly skippable: boolean;
  readonly stoppable: boolean;
}
