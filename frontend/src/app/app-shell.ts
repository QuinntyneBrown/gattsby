import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// The app shell: the skip link and the frame every page sits in. Pages are lazy routes
// (app.routes.ts); each draws its own app bar and its `<main id="main">`.
@Component({
  selector: 'g-app-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main" (click)="skipToMain($event)">Skip to content</a>
    <div class="app"><router-outlet /></div>
  `,
})
export class AppShell {
  private readonly document = inject(DOCUMENT);

  // With `<base href="/">`, a plain `#main` link would load `/#main`; move focus instead.
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.document.getElementById('main')?.focus();
  }
}
