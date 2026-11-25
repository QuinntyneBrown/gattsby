// Why the loop ended (FR-045; end-the-loop design).
export type StopReason =
  | 'finish'
  | 'confidenceReached'
  | 'stepBudget'
  | 'noProgress'
  | 'personStop'
  | 'emergencyStop'
  | 'failure';
