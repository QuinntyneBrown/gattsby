import { InjectionToken } from '@angular/core';
import type { LanguageModelApi } from './language-model-api';

// Chrome's Prompt API, or undefined where there is none (checklist mode). Only the model adapter
// injects it (NFR-021).
export const LANGUAGE_MODEL = new InjectionToken<LanguageModelApi | undefined>('LANGUAGE_MODEL', {
  providedIn: 'root',
  factory: () => (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel ?? undefined,
});
