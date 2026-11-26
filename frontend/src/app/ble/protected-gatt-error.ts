import { ToolError } from '../tools/tool-error';

export class ProtectedGattError extends ToolError {
  constructor(
    readonly uuid: string,
    message: string,
    readonly entryId: string,
  ) {
    super('AUTH_REQUIRED', message, [entryId]);
  }
}
