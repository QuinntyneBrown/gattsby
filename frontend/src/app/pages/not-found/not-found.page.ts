import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandComponent } from '../../ui/brand/brand.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';

// Shown for any address no route matches (docs/mocks/pages/not-found/default.html). The mock's
// "Import a record" action arrives with the import dialog (journey 16).
@Component({
  selector: 'g-not-found-page',
  imports: [BrandComponent, EmptyStateComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <header class="appbar appbar--home"><g-brand /></header>
    <main id="main" class="page page--reading" tabindex="-1">
      <g-empty-state
        title="This investigation isn’t on this device"
        text="It may have been deleted, or the link came from another browser. Investigations are only stored where they ran; to move one, export it there and import it here."
      >
        <svg emptyIcon class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <a class="btn btn--primary" routerLink="/">Go to home</a>
      </g-empty-state>
    </main>
  `,
})
export class NotFoundPage {}
