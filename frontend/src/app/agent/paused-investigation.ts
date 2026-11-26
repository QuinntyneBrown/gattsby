import type { Stage } from '../store/model/stage';

export interface PausedInvestigation {
  readonly reason: 'person' | 'idle';
  readonly stage: Stage;
  readonly instruction: string;
}
