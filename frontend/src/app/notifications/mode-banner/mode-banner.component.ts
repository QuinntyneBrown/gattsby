import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'g-mode-banner',
  host: { class: 'alert inv-banner', role: 'status', 'aria-label': 'Operating mode' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5m0-8h.01" />
    </svg>
    <div class="alert__body">
      <p class="alert__title">Running as a checklist.</p>
      <p>
        The on-device model is off for this investigation. You pick each step; Gattsby runs it and
        explains the result.
      </p>
    </div>
  `,
})
export class ModeBannerComponent {}
