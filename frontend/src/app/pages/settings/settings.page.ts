import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReadinessSession } from '../../environment/readiness-session';
import { InvestigationStore } from '../../store/investigation-store';

@Component({
  selector: 'g-settings-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="appbar">
      <a class="btn btn--ghost btn--icon" routerLink="/" aria-label="Back">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </a>
      <div class="appbar__titles"><h1 class="appbar__title">Settings</h1></div>
    </header>
    <main id="main" class="page page--reading" tabindex="-1" [attr.aria-busy]="loading()">
      <section>
        <h2 class="section-title">Mode</h2>
        @if (loading()) {
          <p role="status">Loading settings…</p>
        } @else {
          @if (failed()) {
            <div class="alert alert--danger" role="alert">
              <div class="alert__body">
                <p class="alert__title">Couldn’t save or load the mode setting.</p>
                <p>Check that Chrome allows site data, then try again.</p>
              </div>
            </div>
          }
          @if (value() !== null) {
            <label class="switch">
              <input
                #mode
                type="checkbox"
                [checked]="value()"
                [disabled]="saving()"
                (change)="save(mode.checked)"
              />
              <span>Use the agent when it’s available</span>
            </label>
            <p class="fine-print">
              Off: every investigation runs as a checklist, even when the on-device model is ready.
            </p>
          } @else {
            <button class="btn btn--lg" type="button" (click)="load()">Try again</button>
          }
          <a class="btn btn--lg" routerLink="/start">Check on-device model</a>
        }
      </section>
    </main>
  `,
})
export class SettingsPage implements OnInit {
  private readonly store = inject(InvestigationStore);
  private readonly session = inject(ReadinessSession);
  protected readonly value = signal<boolean | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.value.set(await this.store.useAgentWhenAvailable());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(enabled: boolean): Promise<void> {
    const previous = this.value();
    this.value.set(enabled);
    this.saving.set(true);
    this.failed.set(false);
    try {
      await this.store.setUseAgentWhenAvailable(enabled);
      this.session.continueAs(enabled ? 'agent' : 'checklist');
    } catch {
      this.value.set(previous);
      this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
