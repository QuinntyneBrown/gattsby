import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DeleteAllDataDialog } from '../../dialogs/delete-all-data/delete-all-data.dialog';
import { ReadinessSession } from '../../environment/readiness-session';
import { formatStorage } from '../../shared/format-storage';
import { InvestigationStore } from '../../store/investigation-store';
import type { LocalDataCounts } from '../../store/model/local-data-counts';
import type { StorageUsage } from '../../store/model/storage-usage';
import { PendingVerdict } from '../../store/pending-verdict';

@Component({
  selector: 'g-settings-page',
  imports: [DeleteAllDataDialog, RouterLink],
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
      <section style="margin-top: var(--space-8)" aria-labelledby="data-heading">
        <h2 id="data-heading" class="section-title">Data on this device</h2>
        @if (usage(); as storage) {
          <p class="text-muted">
            @if (counts(); as total) {
              {{ total.investigations }}
              {{ total.investigations === 1 ? 'investigation' : 'investigations' }} ·
              {{ total.profiles }}
              {{ total.profiles === 1 ? 'device profile' : 'device profiles' }} · {{ total.photos }}
              {{ total.photos === 1 ? 'photo' : 'photos' }} · {{ size(storage.usageBytes) }}
            }
          </p>
          @if (storage.persisted) {
            <p>Chrome granted persistent storage.</p>
          } @else {
            <button
              class="btn btn--lg"
              type="button"
              [disabled]="requestingPersistence()"
              (click)="requestPersistence()"
            >
              Keep data when space is low
            </button>
          }
        }
        @if (storageMessage()) {
          <p role="status">{{ storageMessage() }}</p>
        }
        <a class="btn btn--lg" routerLink="/investigations">Past investigations</a>
        @if (counts()) {
          <p class="text-muted">Delete every investigation, device profile, photo and setting.</p>
          <button class="btn btn--lg" type="button" (click)="openDelete()">Delete all data</button>
        }
      </section>
    </main>
    @if (showDelete() && counts(); as total) {
      <g-delete-all-data-dialog
        [counts]="total"
        [busy]="deleting()"
        [blocked]="blocked()"
        [error]="deleteError()"
        (closed)="showDelete.set(false)"
        (confirmed)="deleteAll()"
      />
    }
  `,
})
export class SettingsPage implements OnInit {
  private readonly store = inject(InvestigationStore);
  private readonly session = inject(ReadinessSession);
  private readonly router = inject(Router);
  private readonly pendingVerdict = inject(PendingVerdict);
  protected readonly value = signal<boolean | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  protected readonly usage = signal<StorageUsage | null>(null);
  protected readonly counts = signal<LocalDataCounts | null>(null);
  protected readonly size = formatStorage;
  protected readonly requestingPersistence = signal(false);
  protected readonly storageMessage = signal<string | null>(null);
  protected readonly showDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly blocked = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
    void this.loadStorage();
  }

  private async loadStorage(): Promise<void> {
    try {
      const [usage, counts] = await Promise.all([this.store.usage(), this.store.localDataCounts()]);
      this.usage.set(usage);
      this.counts.set(counts);
    } catch {
      this.storageMessage.set('Couldn’t read storage use. Try reloading Settings.');
    }
  }

  protected async requestPersistence(): Promise<void> {
    this.requestingPersistence.set(true);
    try {
      const granted = await this.store.requestPersistence(true);
      this.storageMessage.set(granted ? null : 'Chrome didn’t grant persistent storage.');
      await this.loadStorage();
    } catch {
      this.storageMessage.set('Couldn’t request persistent storage. Try again.');
    } finally {
      this.requestingPersistence.set(false);
    }
  }

  protected openDelete(): void {
    this.deleteError.set(null);
    this.showDelete.set(true);
  }

  protected async deleteAll(): Promise<void> {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.blocked.set(false);
    this.deleteError.set(null);
    try {
      await this.store.deleteAll(() => this.blocked.set(true));
      this.session.reset();
      this.pendingVerdict.commit.set(null);
      this.showDelete.set(false);
      await this.router.navigate(['/'], { replaceUrl: true, info: 'local-data-deleted' });
    } catch {
      this.deleteError.set('Couldn’t delete the stored data. Try again.');
    } finally {
      this.deleting.set(false);
    }
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
