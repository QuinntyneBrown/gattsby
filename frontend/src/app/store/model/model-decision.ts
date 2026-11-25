export interface ModelDecision {
  readonly startedAt: number;
  readonly promptTokens: number | null;
  readonly modelMs: number;
  readonly rawText?: string;
}
