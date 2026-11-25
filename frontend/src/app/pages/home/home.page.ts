import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { InvestigationStarter } from '../../agent/investigation-starter';
import { CapabilityDetector } from '../../environment/capability-detector';
import { ModeSelector } from '../../environment/mode-selector';
import { InvestigationStore } from '../../store/investigation-store';
import { BrandComponent } from '../../ui/brand/brand.component';

// The Home page (docs/mocks/pages/home/empty.html and default.html). "Identify a device" creates
// and stores the investigation before the first prompt (FR-007). The paused investigation, saved
// devices, past investigations and missing-tool requests join with journeys 11, 4, 15 and 14.
@Component({
  selector: 'g-home-page',
  imports: [BrandComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <header class="appbar appbar--home">
      <g-brand />
      <div class="appbar__actions">
        <a class="btn btn--ghost" routerLink="/start">Readiness</a>
        @if (mode(); as m) {
          <span class="mode-chip">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"
              />
            </svg>
            {{ m === 'agent' ? 'Agent mode' : 'Checklist mode' }}
          </span>
        }
      </div>
    </header>
    <main id="main" class="page page--reading" tabindex="-1">
      <section style="padding-top: var(--space-8)">
        @if (returning()) {
          <h1 class="hero__title">What are we looking at today?</h1>
          <p class="lead">Treadmill, bike, rower, strap or trainer — switch it on and start.</p>
        } @else {
          <h1 class="hero__title">Stand next to a machine. Let’s find out how it talks.</h1>
          <p class="lead">
            Gattsby scans, connects and listens while you use the machine, then tells you what your
            software can read and control. No Bluetooth knowledge needed.
          </p>
        }
        <div style="margin-top: var(--space-6)">
          <button
            class="btn btn--primary btn--lg"
            type="button"
            [disabled]="starting()"
            (click)="identify()"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M12 5v14" />
            </svg>
            Identify a device
          </button>
        </div>
        @if (failed()) {
          <div class="alert alert--danger" role="alert" style="margin-top: var(--space-6)">
            <div class="alert__body">
              <p class="alert__title">Couldn’t start the investigation.</p>
              <p>
                Chrome didn’t answer when Gattsby opened its storage. Nothing has been lost. Try
                again.
              </p>
            </div>
          </div>
        }
      </section>
      <p class="fine-print" style="margin-top: var(--space-10)">
        Everything runs on this device. Nothing is sent to a server.
      </p>
    </main>
  `,
})
export class HomePage implements OnInit {
  private readonly starter = inject(InvestigationStarter);
  private readonly store = inject(InvestigationStore);
  private readonly capabilities = inject(CapabilityDetector);
  private readonly modes = inject(ModeSelector);
  private readonly router = inject(Router);
  protected readonly returning = signal(false);
  protected readonly starting = signal(false);
  protected readonly failed = signal(false);
  protected readonly mode = signal<'agent' | 'checklist' | null>(null);

  ngOnInit(): void {
    void this.store.list().then(
      (investigations) => this.returning.set(investigations.length > 0),
      () => this.returning.set(false),
    );
    void this.capabilities.detect().then((c) => this.mode.set(this.modes.select(c)));
  }

  protected async identify(): Promise<void> {
    this.starting.set(true);
    this.failed.set(false);
    try {
      const id = await this.starter.start();
      await this.router.navigate(id ? ['/investigations', id] : ['/start']);
    } catch {
      this.failed.set(true);
    } finally {
      this.starting.set(false);
    }
  }
}
