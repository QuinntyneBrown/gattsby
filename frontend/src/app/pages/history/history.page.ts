import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { InvestigationStarter } from '../../agent/investigation-starter';
import { STAGE_NAMES } from '../../agent/stage-names';
import { DeleteInvestigationDialog } from '../../dialogs/delete-investigation/delete-investigation.dialog';
import { ImportDialog } from '../../dialogs/import/import.dialog';
import { formatStorage, storageWarningPercent } from '../../shared/format-storage';
import { InvestigationStore } from '../../store/investigation-store';
import type { Investigation } from '../../store/model/investigation';
import type { StorageUsage } from '../../store/model/storage-usage';
import { VerdictMarkComponent } from '../../ui/verdict-mark/verdict-mark.component';

@Component({
  selector: 'g-history-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DeleteInvestigationDialog, ImportDialog, RouterLink, VerdictMarkComponent],
  styles: `
    :host {
      display: contents;
    }
    .history {
      width: 100%;
      max-width: 48rem;
      margin-inline: auto;
    }
    .row__title,
    .row__meta {
      overflow-wrap: anywhere;
    }
    .summary {
      padding: var(--space-3) var(--layout-margin);
    }
    .history .row {
      padding-inline: var(--layout-margin);
    }
    .history .row > a {
      flex: 1;
      min-width: 0;
      padding: 0;
    }
  `,
  template: `
    <div class="app">
      <header class="appbar">
        <a class="btn btn--ghost btn--icon" routerLink="/" aria-label="Back">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </a>
        <div class="appbar__titles">
          <h1 class="appbar__title">Past investigations</h1>
          @if (!loading() && !failed()) {
            <p class="appbar__subtitle">{{ rows().length }} on this device · newest first</p>
          }
        </div>
      </header>
      <main id="main" class="history" tabindex="-1" [attr.aria-busy]="loading()">
        @if (loading()) {
          <p class="summary" role="status">Loading your investigations…</p>
        } @else if (failed()) {
          <section class="page page--reading empty">
            <h2>Couldn’t read your investigations</h2>
            <p>Chrome didn’t answer when Gattsby opened its storage. Nothing has been lost.</p>
            <button class="btn btn--primary btn--lg" type="button" (click)="load()">
              Try again
            </button>
            <a class="btn btn--lg" routerLink="/">Back to home</a>
          </section>
        } @else {
          <section class="summary text-muted" aria-label="Storage">
            @if (usage()?.quotaBytes) {
              {{ size(usage()!.usageBytes) }} used of {{ size(usage()!.quotaBytes) }} available
            } @else {
              Chrome didn’t report storage use.
            }
          </section>
          @if (storageWarning(); as percent) {
            <div class="alert alert--warning summary" role="status">
              <div class="alert__body">
                <p class="alert__title">Storage is nearly full</p>
                <p>
                  Gattsby is using {{ percent }}% of the space Chrome allows it. Export old
                  investigations, then delete them.
                </p>
              </div>
            </div>
          }
          @if (rows().length) {
            <ul class="rows rows--flush" aria-label="Past investigations">
              @for (row of rows(); track row.id) {
                <li>
                  <div class="row">
                    <a
                      class="row"
                      [routerLink]="
                        row.verdict
                          ? ['/investigations', row.id, 'verdict']
                          : row.readOnly
                            ? ['/investigations', row.id, 'evidence']
                            : ['/investigations', row.id]
                      "
                      [queryParams]="row.verdict || row.readOnly ? null : { resume: true }"
                    >
                      @if (row.verdict) {
                        <g-verdict-mark [kind]="row.verdict.kind" />
                      } @else {
                        <svg class="vdot" viewBox="0 0 12 12" aria-hidden="true">
                          <circle
                            cx="6"
                            cy="6"
                            r="4.5"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-dasharray="2 2"
                          />
                        </svg>
                      }
                      <span class="row__body">
                        <span class="row__title"
                          ><bdi>{{ row.deviceName ?? 'New investigation' }}</bdi></span
                        >
                        <span class="row__meta">{{
                          row.verdict?.label ??
                            (row.readOnly
                              ? 'Imported investigation record'
                              : 'In progress · paused at ' + stages[row.stage])
                        }}</span>
                        <span class="row__meta row__meta--xs">
                          @if (isToday(row.startedAt)) {
                            Today, {{ row.startedAt | date: 'HH:mm' }}
                          } @else {
                            {{ row.startedAt | date: 'EEE d MMM' }}
                          }
                          @if (row.location) {
                            · <bdi>{{ row.location }}</bdi>
                          }
                        </span>
                      </span>
                    </a>
                    <button
                      class="btn btn--ghost btn--icon"
                      type="button"
                      [attr.aria-label]="
                        'Delete the investigation of ' +
                        (row.deviceName ?? 'New investigation') +
                        ', ' +
                        (row.startedAt | date: 'EEE d MMM')
                      "
                      (click)="confirmDeletion(row)"
                    >
                      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              }
            </ul>
          } @else {
            <section class="page page--reading empty">
              <h2>No investigations yet</h2>
              <p>Start an investigation to identify a device and save its verdict.</p>
              <button
                class="btn btn--primary btn--lg"
                type="button"
                [disabled]="starting()"
                (click)="identify()"
              >
                Identify a device
              </button>
              <button class="btn btn--lg" type="button" (click)="showImport.set(true)">
                Import a record
              </button>
              @if (startFailed()) {
                <p role="alert">Couldn’t start an investigation. Try again.</p>
              }
            </section>
          }
        }
      </main>
    </div>
    @if (showImport()) {
      <g-import-dialog (closed)="showImport.set(false)" (imported)="load()" />
    }
    @if (deletion(); as row) {
      <g-delete-investigation-dialog
        [deviceName]="row.deviceName ?? 'New investigation'"
        [startedAt]="row.startedAt"
        [busy]="deleting()"
        [error]="deleteError()"
        (confirmed)="deleteInvestigation(row.id)"
        (closed)="deletion.set(null)"
      />
    }
  `,
})
export class HistoryPage implements OnInit {
  private readonly store = inject(InvestigationStore);
  private readonly starter = inject(InvestigationStarter);
  private readonly router = inject(Router);
  protected readonly rows = signal<readonly Investigation[]>([]);
  protected readonly usage = signal<StorageUsage | null>(null);
  protected readonly storageWarning = computed(() => storageWarningPercent(this.usage()));
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly showImport = signal(false);
  protected readonly starting = signal(false);
  protected readonly startFailed = signal(false);
  protected readonly deletion = signal<Investigation | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly stages = STAGE_NAMES;
  protected readonly size = formatStorage;

  ngOnInit(): void {
    void this.load();
  }

  protected isToday(timestamp: number): boolean {
    return new Date(timestamp).toDateString() === new Date().toDateString();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const [rows, usage] = await Promise.all([this.store.list(), this.store.usage()]);
      this.rows.set(rows);
      this.usage.set(usage);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected async identify(): Promise<void> {
    this.starting.set(true);
    this.startFailed.set(false);
    try {
      const id = await this.starter.start();
      await this.router.navigate(id ? ['/investigations', id] : ['/start']);
    } catch {
      this.startFailed.set(true);
    } finally {
      this.starting.set(false);
    }
  }

  protected confirmDeletion(row: Investigation): void {
    this.deleteError.set(null);
    this.deletion.set(row);
  }

  protected async deleteInvestigation(id: string): Promise<void> {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.store.delete(id);
      this.rows.update((rows) => rows.filter((row) => row.id !== id));
      this.deletion.set(null);
      await this.load();
    } catch {
      this.deleteError.set('Couldn’t delete the investigation. Try again.');
    } finally {
      this.deleting.set(false);
    }
  }
}
