import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ChecklistFallbackReason } from '../../store/model/mode-change';

const REASONS: Readonly<Record<ChecklistFallbackReason, string>> = {
  sessionFailed: 'The on-device model session stopped.',
  twoTimeouts: 'The on-device model stopped answering twice in a row.',
  contextExhausted: 'The investigation ran out of space in the on-device model.',
  threeInvalidActions: 'Three steps from the on-device model could not run.',
};

@Component({
  selector: 'g-mode-banner',
  host: {
    class: 'alert inv-banner',
    '[class.alert--warning]': 'reason() !== null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5m0-8h.01" />
    </svg>
    <div class="alert__body" role="status" aria-label="Operating mode">
      @if (reason(); as why) {
        <p class="alert__title">Continuing as a checklist.</p>
        <p>{{ messages[why] }} Everything found so far is kept. You pick the next steps.</p>
      } @else {
        <p class="alert__title">Running as a checklist.</p>
        <p>
          The on-device model is off for this investigation. You pick each step; Gattsby runs it and
          explains the result.
        </p>
      }
    </div>
    <button
      class="btn btn--ghost btn--icon"
      type="button"
      aria-label="Dismiss mode notice"
      (click)="dismissed.emit()"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </button>
  `,
})
export class ModeBannerComponent {
  readonly reason = input<ChecklistFallbackReason | null>(null);
  readonly dismissed = output<void>();
  protected readonly messages = REASONS;
}
