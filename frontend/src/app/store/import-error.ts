export type ImportErrorCode =
  | 'FILE_TOO_LARGE'
  | 'NOT_JSON'
  | 'FORBIDDEN_KEY'
  | 'NOT_GATTSBY'
  | 'UNSUPPORTED_VERSION'
  | 'SCHEMA_INVALID'
  | 'ALREADY_EXISTS'
  | 'STORAGE_FULL'
  | 'UNREADABLE_FILE'
  | 'STORAGE_UNAVAILABLE';

export class ImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}
