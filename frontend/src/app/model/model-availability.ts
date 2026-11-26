import type { LanguageModelAvailability } from './language-model-api';

export interface ModelAvailability {
  readonly api: boolean;
  readonly availability: LanguageModelAvailability;
  readonly imageInput: boolean;
  readonly source?: 'phone';
  readonly reason?: 'webgpu';
  readonly downloadBytes?: number;
}
