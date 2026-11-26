import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter, map } from 'rxjs';

// The app shell: the skip link and the frame every page sits in. Pages are lazy routes
// (app.routes.ts); each draws its own app bar and its `<main id="main">`.
@Component({
  selector: 'g-app-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main" (click)="skipToMain($event)">Skip to content</a>
    <div class="app"><router-outlet /></div>
    <div class="toast-region" role="status" aria-live="polite">
      @if (offerUpdate()) {
        <div class="toast toast--info">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <div class="toast__body">
            <div class="toast__title">A new version is ready</div>
            <button
              class="toast__action"
              type="button"
              (click)="reload()"
              (keydown.escape)="dismissUpdate()"
            >
              Reload
            </button>
          </div>
          <button
            class="close"
            type="button"
            aria-label="Dismiss"
            (click)="dismissUpdate()"
            (keydown.escape)="dismissUpdate()"
          >
            <svg class="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class AppShell {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly readyVersion = toSignal(
    inject(SwUpdate).versionUpdates.pipe(
      filter((event) => event.type === 'VERSION_READY'),
      map((event) => event.latestVersion.hash),
    ),
  );
  private readonly dismissedVersion = signal<string | undefined>(undefined);

  protected readonly offerUpdate = computed(() => {
    const version = this.readyVersion();
    if (!version || version === this.dismissedVersion()) return false;
    if (this.router.currentNavigation() || !this.router.lastSuccessfulNavigation()) return false;
    return this.router.routerState.snapshot.root.firstChild?.data['holdAppUpdate'] !== true;
  });

  // With `<base href="/">`, a plain `#main` link would load `/#main`; move focus instead.
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.document.getElementById('main')?.focus();
  }

  protected dismissUpdate(): void {
    this.dismissedVersion.set(this.readyVersion());
  }

  protected reload(): void {
    if (this.offerUpdate()) this.document.defaultView?.location.reload();
  }
}
