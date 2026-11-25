import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { PersonPrompt } from '../../store/model/person-prompt';
import type { PromptResponse } from '../../store/model/prompt-response';

export type PromptCardResponse = Omit<PromptResponse, 'respondedAt'>;

const FREE_TEXT_LIMIT = 500;

// The prompt in the dock (ask-the-person design): one question, action or tap at a time, or the
// step running when nothing is asked. Every string is bound as text.
@Component({
  selector: 'g-prompt-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
    .free-text {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-4);
    }
    .free-text .input {
      flex: 1;
      min-width: 0;
      min-height: 48px;
    }
    .skip {
      margin-top: var(--space-3);
    }
  `,
  template: `
    <div class="dock__inner">
      @if (prompt(); as p) {
        @if (p.sequence) {
          <p class="prompt__eyebrow">{{ p.sequence }}</p>
        }
        <h2 class="prompt__title" id="prompt-title">
          @if (p.kind === 'tap') {
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5M19.1 4.9C23 8.8 23 15.1 19.1 19"
              />
              <circle cx="12" cy="12" r="2" />
            </svg>
          }
          {{ p.title }}
        </h2>
        @if (p.detail) {
          <p class="prompt__detail">{{ p.detail }}</p>
        }
        @if (p.steps.length > 0) {
          <ol class="steps">
            @for (step of p.steps; track $index) {
              <li>{{ step }}</li>
            }
          </ol>
        }
        @if (p.kind === 'question') {
          <div class="replies" role="group" aria-label="Suggested answers">
            @for (answer of p.answers; track answer) {
              <button class="reply" type="button" (click)="choose(p, answer)">{{ answer }}</button>
            }
          </div>
          @if (p.allowFreeText) {
            <form class="free-text" (submit)="sendFreeText($event, p)">
              <label class="visually-hidden" [attr.for]="p.id + '-text'"
                >Or type your own answer</label
              >
              <input
                class="input"
                type="text"
                [id]="p.id + '-text'"
                [maxLength]="limit"
                placeholder="Or type your own answer"
                autocomplete="off"
                [value]="text()"
                (input)="text.set(value($event))"
              />
              <button class="btn" type="submit" aria-label="Send answer">Send</button>
            </form>
          }
        } @else {
          <div class="prompt__actions">
            @for (answer of p.answers; track answer; let first = $first) {
              <button
                class="btn btn--lg"
                [class.btn--primary]="first"
                type="button"
                (click)="choose(p, answer)"
              >
                {{ answer }}
              </button>
            }
            @if (p.stoppable) {
              <button class="btn btn--lg" type="button" (click)="stop.emit()">Stop</button>
            }
          </div>
        }
        @if (p.skippable) {
          <button class="btn btn--ghost skip" type="button" (click)="skip(p)">Skip</button>
        }
      } @else if (running(); as r) {
        <p class="prompt__eyebrow">
          <span class="spinner spinner--xs" aria-hidden="true"></span>Now
        </p>
        <h2 class="prompt__title" id="prompt-title">{{ r.label }}</h2>
        <p class="prompt__detail">{{ r.detail }}</p>
      }
    </div>
  `,
})
export class PromptCardComponent {
  readonly prompt = input<PersonPrompt | null>(null);
  readonly running = input<{ label: string; detail: string } | null>(null);
  readonly respond = output<PromptCardResponse>();
  readonly stop = output<void>();
  protected readonly limit = FREE_TEXT_LIMIT;
  protected readonly text = signal('');

  protected choose(prompt: PersonPrompt, answer: string): void {
    const now = performance.timeOrigin + performance.now();
    this.respond.emit({
      promptId: prompt.id,
      answer,
      freeText: null,
      skipped: false,
      readyAt: null,
      doneAt: prompt.kind === 'action' ? now : null,
    });
  }

  protected sendFreeText(event: Event, prompt: PersonPrompt): void {
    event.preventDefault();
    const text = this.text().trim().slice(0, FREE_TEXT_LIMIT);
    if (!text) return;
    this.text.set('');
    this.respond.emit({
      promptId: prompt.id,
      answer: text,
      freeText: text,
      skipped: false,
      readyAt: null,
      doneAt: null,
    });
  }

  protected skip(prompt: PersonPrompt): void {
    this.respond.emit({
      promptId: prompt.id,
      answer: '',
      freeText: null,
      skipped: true,
      readyAt: null,
      doneAt: null,
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
