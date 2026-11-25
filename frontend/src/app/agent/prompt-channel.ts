import { inject, Injectable, signal } from '@angular/core';
import { Clock } from '../shared/clock';
import { ToolError } from '../tools/tool-error';
import type { PersonPrompt } from '../store/model/person-prompt';
import type { PromptResponse } from '../store/model/prompt-response';

export type NewPrompt = Omit<PersonPrompt, 'id'>;

// Posts one prompt at a time to the dock and resolves the person's response (ask-the-person
// design). The page renders `current` and passes the card's output to `respond`.
@Injectable()
export class PromptChannel {
  private readonly clock = inject(Clock);
  private readonly prompt = signal<PersonPrompt | null>(null);
  private pending: {
    resolve: (response: PromptResponse) => void;
    reject: (error: unknown) => void;
  } | null = null;
  private counter = 0;
  readonly current = this.prompt.asReadonly();

  post(prompt: NewPrompt, signal?: AbortSignal): Promise<PromptResponse> {
    if (this.pending) {
      return Promise.reject(new ToolError('PRECONDITION_FAILED', 'A prompt is already open.'));
    }
    const posted: PersonPrompt = { ...prompt, id: `p-${++this.counter}` };
    return new Promise<PromptResponse>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.prompt.set(posted);
      signal?.addEventListener('abort', () => this.cancel(), { once: true });
    });
  }

  respond(response: Omit<PromptResponse, 'respondedAt'>): void {
    const pending = this.pending;
    const current = this.prompt();
    if (!pending || !current || current.id !== response.promptId) return;
    this.pending = null;
    this.prompt.set(null);
    pending.resolve({ ...response, respondedAt: this.clock.now() });
  }

  /** Withdraws the open prompt on stop (ABORTED). */
  cancel(): void {
    const pending = this.pending;
    this.pending = null;
    this.prompt.set(null);
    pending?.reject(new ToolError('ABORTED', 'The prompt was withdrawn.'));
  }
}
