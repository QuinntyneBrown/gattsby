import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

// The Gattsby mark and wordmark, linking home (docs/design-system/components/brand.html).
@Component({
  selector: 'g-brand',
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    @if (standalone()) {
      <span class="brand brand--lg brand--static">
        <ng-container [ngTemplateOutlet]="mark" />
        <span class="visually-hidden">Gattsby</span>
      </span>
    } @else {
      <a class="brand" routerLink="/" aria-label="Gattsby, home">
        <ng-container [ngTemplateOutlet]="mark" />
      </a>
    }
    <ng-template #mark>
      <svg class="mark" viewBox="0 0 64 64" aria-hidden="true">
        <path class="mark__arc" d="M48.97 15.03 A24 24 0 1 0 56 32 H44" />
        <circle class="mark__dot" cx="32" cy="32" r="4.5" />
      </svg>
      <span class="wordmark" aria-hidden="true">ga<span class="wordmark__tt">t</span>tsby</span>
    </ng-template>
  `,
})
export class BrandComponent {
  readonly standalone = input(false);
}
