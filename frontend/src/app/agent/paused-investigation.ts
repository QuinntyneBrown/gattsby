export interface PausedInvestigation {
  readonly reason: 'person' | 'idle' | 'hidden';
  readonly instruction: string;
}
