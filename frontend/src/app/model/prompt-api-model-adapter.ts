import { inject, Injectable } from '@angular/core';
import { LANGUAGE_MODEL } from './language-model.token';
import type { ModelAvailability } from './model-availability';

// The only code that touches `LanguageModel` (NFR-021). Journey 2 needs its availability only;
// sessions and prompts arrive with full agent mode (journey 6). Loaded with a dynamic import.
@Injectable({ providedIn: 'root' })
export class PromptApiModelAdapter {
  private readonly api = inject(LANGUAGE_MODEL);

  async availability(): Promise<ModelAvailability> {
    if (!this.api) return { api: false, availability: 'unavailable', imageInput: false };
    const availability = await this.api.availability();
    const image = await this.api
      .availability({ expectedInputs: [{ type: 'image' }] })
      .catch(() => 'unavailable' as const);
    return { api: true, availability, imageInput: image === 'available' };
  }
}
