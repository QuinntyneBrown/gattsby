export type StoreErrorCode =
  | 'STORAGE_FULL'
  | 'STORAGE_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'ALREADY_CONCLUDED'
  | 'UNREADABLE_PROFILE'
  | 'DATABASE_BLOCKED';

// A refusal from the investigation store; a screen branches on its `code`.
export class StoreError extends Error {
  constructor(
    readonly code: StoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StoreError';
  }
}
