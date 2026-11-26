export interface ProprietaryRecording {
  readonly status: 'ready' | 'skipped' | 'recorded' | 'failed';
  readonly id?: string;
  readonly count?: number;
  readonly seconds?: number;
}
