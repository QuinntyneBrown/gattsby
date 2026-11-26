import { inject, Injectable, Injector } from '@angular/core';
import { LANGUAGE_MODEL } from './language-model.token';
import type { ModelAdapter } from './model-adapter';

@Injectable({ providedIn: 'root' })
export class ModelAdapterLoader {
  private readonly injector = inject(Injector);
  private readonly native = inject(LANGUAGE_MODEL);

  async load(): Promise<ModelAdapter | null> {
    if (this.native) {
      const { PromptApiModelAdapter } = await import('./prompt-api-model-adapter');
      return this.injector.get(PromptApiModelAdapter);
    }
    const browser = navigator as Navigator & { userAgentData?: { platform?: string } };
    const android =
      browser.userAgentData?.platform === 'Android' || /Android/.test(browser.userAgent);
    if (!android) return null;
    const { WebGpuModelAdapter } = await import('./web-gpu-model-adapter');
    return this.injector.get(WebGpuModelAdapter);
  }
}
