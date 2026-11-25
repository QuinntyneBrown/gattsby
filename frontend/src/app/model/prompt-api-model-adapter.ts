import { inject, Injectable } from '@angular/core';
import { LANGUAGE_MODEL } from './language-model.token';
import type { ModelAvailability } from './model-availability';

const TEXT_SESSION = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
} as const;

// The only code that touches `LanguageModel` (NFR-021). Loaded with a dynamic import.
@Injectable({ providedIn: 'root' })
export class PromptApiModelAdapter {
  private readonly api = inject(LANGUAGE_MODEL);

  async availability(): Promise<ModelAvailability> {
    if (!this.api) return { api: false, availability: 'unavailable', imageInput: false };
    const availability = await this.api.availability(TEXT_SESSION);
    const image = await this.api
      .availability({
        ...TEXT_SESSION,
        expectedInputs: [...TEXT_SESSION.expectedInputs, { type: 'image' }],
      })
      .catch(() => 'unavailable' as const);
    return { api: true, availability, imageInput: image === 'available' };
  }

  async download(onProgress: (percent: number) => void, signal: AbortSignal): Promise<void> {
    if (!this.api) throw new DOMException('The model is unavailable.', 'NotSupportedError');
    const listeners = new AbortController();
    try {
      const session = await this.api.create({
        ...TEXT_SESSION,
        signal,
        monitor: (monitor) => {
          monitor.addEventListener(
            'downloadprogress',
            (event) => {
              const loaded = (event as ProgressEvent).loaded;
              if (Number.isFinite(loaded))
                onProgress(Math.max(0, Math.min(100, Math.round(loaded * 100))));
            },
            { signal: listeners.signal },
          );
        },
      });
      session.destroy();
    } finally {
      listeners.abort();
    }
  }
}
