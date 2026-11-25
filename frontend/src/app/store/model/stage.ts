// The playbook's seven stages, in order (FR-049).
export const STAGES = [
  'prepare',
  'find',
  'identify',
  'standard',
  'proprietary',
  'control',
  'conclude',
] as const;

export type Stage = (typeof STAGES)[number];
