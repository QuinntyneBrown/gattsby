// The person's answer to one prompt (ask-the-person design).
export interface PromptResponse {
  readonly promptId: string;
  readonly answer: string;
  readonly freeText: string | null;
  readonly skipped: boolean;
  readonly readyAt: number | null;
  readonly doneAt: number | null;
  readonly respondedAt: number;
}
