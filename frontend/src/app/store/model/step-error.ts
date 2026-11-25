import type { ErrorCode } from '../../tools/error-code';
import type { Stage } from './stage';

// A failed or refused step, kept for local diagnostics (NFR-025).
export interface StepError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly tool: string;
  readonly stage: Stage;
  readonly at: number;
}
