import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BrandComponent } from '../../ui/brand/brand.component';

// The Home page (docs/mocks/pages/home/default.html). Journey 1 draws its app bar only; the
// readiness summary, "Start an investigation" and the recent investigations arrive with journey 2.
@Component({
  selector: 'g-home-page',
  imports: [BrandComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <header class="appbar appbar--home"><g-brand /></header>
    <main id="main" class="page" tabindex="-1"></main>
  `,
})
export class HomePage {}
