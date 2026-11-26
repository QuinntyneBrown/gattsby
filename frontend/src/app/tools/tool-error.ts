import type { ErrorCode } from './error-code';

// A refusal with a shared code (return-a-result-envelope design). Tools, the BLE layer and the
// store throw it; the executor turns it into an envelope.
export class ToolError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly evidence: readonly string[] = [],
  ) {
    super(message);
    this.name = 'ToolError';
  }
}
