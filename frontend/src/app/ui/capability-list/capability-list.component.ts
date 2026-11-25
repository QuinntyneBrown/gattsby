import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CapabilityItem } from '../../environment/capability-item';

@Component({
  selector: 'g-capability-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="checks" aria-label="What this device can do">
      @for (item of items(); track item.label) {
        <li class="check">
          <span class="check__icon" [attr.data-status]="item.status" aria-hidden="true">
            @if (item.status === 'pending') {
              <span class="spinner"></span>
            } @else {
              <svg class="icon" viewBox="0 0 24 24">
                @switch (item.status) {
                  @case ('ok') {
                    <path d="M20 6 9 17l-5-5" />
                  }
                  @case ('warn') {
                    <path d="M12 5v8m0 5v1" />
                  }
                  @default {
                    <path d="M6 12h12" />
                  }
                }
              </svg>
            }
          </span>
          <div class="check__body">
            <p class="check__label">{{ item.label }}</p>
            <p class="check__detail">{{ item.detail }}</p>
          </div>
          <span class="check__status">{{ statusWords[item.status] }}</span>
        </li>
      }
    </ul>
  `,
})
export class CapabilityListComponent {
  readonly items = input.required<readonly CapabilityItem[]>();
  protected readonly statusWords = {
    ok: 'Available',
    warn: 'Needs action',
    na: 'Not available',
    pending: 'Checking',
  };
}
