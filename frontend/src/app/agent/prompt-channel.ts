import { inject, Injectable, signal } from '@angular/core';
import { Clock } from '../shared/clock';
import { ToolError } from '../tools/tool-error';
import type { PersonPrompt } from '../store/model/person-prompt';
import type { PromptResponse } from '../store/model/prompt-response';

export type NewPrompt = Omit<PersonPrompt, 'id'>;
const IDLE_MS = 120_000;

// Posts one prompt at a time to the dock and resolves the person's response (ask-the-person
// design). The page renders `current` and passes the card's output to `respond`.
@Injectable()
export class PromptChannel {
  private readonly clock = inject(Clock);
  private readonly prompt = signal<PersonPrompt | null>(null);
  private readonly idleSignal = signal(false);
  private cancelIdleTimer: (() => void) | null = null;
  private pending: {
    resolve: (response: PromptResponse) => void;
    reject: (error: unknown) => void;
    dispose: () => void;
  } | null = null;
  private counter = 0;
  readonly current = this.prompt.asReadonly();
  readonly idle = this.idleSignal.asReadonly();

  post(prompt: NewPrompt, signal?: AbortSignal): Promise<PromptResponse> {
    if (this.pending) {
      return Promise.reject(new ToolError('PRECONDITION_FAILED', 'A prompt is already open.'));
    }
    const posted: PersonPrompt = { ...prompt, id: `p-${++this.counter}` };
    return new Promise<PromptResponse>((resolve, reject) => {
      const abort = () => this.cancel();
      this.pending = {
        resolve,
        reject,
        dispose: () => signal?.removeEventListener('abort', abort),
      };
      this.prompt.set(posted);
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener('abort', abort, { once: true });
      this.armIdleTimer();
    });
  }

  respond(response: Omit<PromptResponse, 'respondedAt'>): void {
    const pending = this.pending;
    const current = this.prompt();
    if (!pending || !current || this.idle() || current.id !== response.promptId) return;
    this.clear();
    pending.resolve({ ...response, respondedAt: this.clock.now() });
  }

  /** Withdraws the open prompt on stop (ABORTED). */
  cancel(): void {
    const pending = this.pending;
    this.clear();
    pending?.reject(new ToolError('ABORTED', 'The prompt was withdrawn.'));
  }

  continueAfterIdle(): void {
    if (!this.pending || !this.idle()) return;
    this.idleSignal.set(false);
    this.armIdleTimer();
  }

  private armIdleTimer(): void {
    if (this.prompt()?.kind !== 'action') return;
    this.cancelIdleTimer = this.clock.setTimeout(() => {
      this.cancelIdleTimer = null;
      this.idleSignal.set(true);
    }, IDLE_MS);
  }

  private clear(): void {
    this.pending?.dispose();
    this.pending = null;
    this.cancelIdleTimer?.();
    this.cancelIdleTimer = null;
    this.idleSignal.set(false);
    this.prompt.set(null);
  }
}
