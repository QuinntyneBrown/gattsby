import { notScripted } from './not-scripted';
import type { ScriptedResponse } from './simulation-config';
import type { Report } from './simulation-event';

interface PromptOptions {
  readonly signal?: AbortSignal;
  readonly responseConstraint?: unknown;
}

// The parts of a Prompt API session the model adapter uses. Each prompt takes the next scripted
// response; a prompt beyond the script is reported as unexpected and rejected.
export class FakeLanguageModelSession {
  readonly inputQuota = 4096;
  inputUsage = 0;

  constructor(
    private readonly responses: ScriptedResponse[],
    private readonly report: Report,
  ) {}

  async prompt(input: unknown, options: PromptOptions = {}): Promise<string> {
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    this.report({ kind: 'model-prompt', input: text });
    this.inputUsage += Math.ceil(text.length / 4);
    const response = this.responses.shift();
    if (!response) {
      const detail = 'prompt with no scripted response left';
      this.report({ kind: 'unexpected-model', detail });
      throw notScripted(detail);
    }
    await delay(response.delayMs ?? 0, options.signal);
    if ('error' in response) {
      throw new DOMException(response.message ?? response.error, response.error);
    }
    return JSON.stringify(response.action);
  }

  async measureInputUsage(input: unknown): Promise<number> {
    this.report({ kind: 'model-call', method: 'measureInputUsage' });
    return Math.ceil((typeof input === 'string' ? input : JSON.stringify(input)).length / 4);
  }

  destroy(): void {
    this.report({ kind: 'model-call', method: 'destroy' });
  }

  promptStreaming(): never {
    return this.unexpected('promptStreaming');
  }

  append(): never {
    return this.unexpected('append');
  }

  async clone(options?: { signal?: AbortSignal }): Promise<FakeLanguageModelSession> {
    options?.signal?.throwIfAborted();
    this.report({ kind: 'model-call', method: 'clone' });
    return new FakeLanguageModelSession(this.responses, this.report);
  }

  private unexpected(method: string): never {
    this.report({ kind: 'unexpected-model', detail: method });
    throw notScripted(method);
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    if (ms === 0) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}
