import { InjectionToken } from '@angular/core';
import type { LanguageModelApi } from './language-model-api';

// Chrome's Prompt API, or undefined where there is none. Capability detection checks for presence
// before loading the adapter; only the model adapter invokes the API (NFR-021).
export const LANGUAGE_MODEL = new InjectionToken<LanguageModelApi | undefined>('LANGUAGE_MODEL', {
  providedIn: 'root',
  factory: () => (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel ?? undefined,
});
