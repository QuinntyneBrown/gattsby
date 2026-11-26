import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExportDialog } from '../../dialogs/export/export.dialog';
import { shortUuid } from '../../knowledge-base/uuid';
import { InvestigationStore } from '../../store/investigation-store';
import type { InvestigationRecord } from '../../store/model/investigation-record';
import type { RawLogEntry } from '../../store/model/raw-log-entry';
import { EVIDENCE_FILTERS, type EvidenceFilter } from './evidence-filter';
import type { EvidenceRow } from './evidence-row';
import { readEvidencePage } from './evidence-timeline';

@Component({
  selector: 'g-evidence-page',
  imports: [DatePipe, DecimalPipe, ExportDialog, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
    .ev__time {
      width: 6rem;
    }
    .ev__char {
      overflow-wrap: anywhere;
    }
  `,
  template: `
    <div class="app app--fixed">
      <header class="appbar">
        <a
          class="btn btn--ghost btn--icon"
          [routerLink]="['/investigations', id(), 'verdict']"
          aria-label="Back"
        >
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </a>
        <div class="appbar__titles">
          <h1 class="appbar__title">Evidence</h1>
          @if (record(); as saved) {
            <p class="appbar__subtitle">
              <bdi>{{ saved.investigation.deviceName ?? 'Investigation' }}</bdi> ·
              {{ packetCount() }} packets · {{ saved.steps.length }} steps
            </p>
          }
        </div>
        @if (record()?.investigation?.profileId; as profileId) {
          <button
            class="btn btn--ghost btn--icon"
            type="button"
            aria-label="Export the log"
            (click)="exporting.set(profileId)"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
            </svg>
          </button>
        }
      </header>
      <main id="main" class="scroll" tabindex="-1" [attr.aria-busy]="loading()">
        @if (!record() || packetCount() || focused()) {
          <div class="toolbar">
            <div class="chips" role="group" aria-label="Show">
              @for (filter of filters; track filter) {
                <button
                  class="chip"
                  type="button"
                  [attr.aria-pressed]="selectedFilter() === filter"
                  (click)="pickFilter(filter)"
                >
                  {{ filter }}
                </button>
              }
            </div>
            @if (focused()) {
              <span>Selected evidence</span>
              @if (selectedFilter() !== 'All' || rows().length) {
                <a
                  class="btn btn--ghost"
                  [routerLink]="['/investigations', id(), 'evidence']"
                  (click)="pickFilter('All')"
                  >Show everything</a
                >
              }
            }
          </div>
        }
        @if (loading()) {
          <p class="page page--reading" role="status">Loading the raw log…</p>
        } @else if (failed()) {
          <section class="page page--reading">
            <h2>Couldn’t load the raw log</h2>
            <p>
              The verdict and profile are fine, but the log for this investigation couldn’t be read
              from storage.
            </p>
            <button class="btn btn--lg" type="button" (click)="retry()">Try again</button>
            <a class="btn btn--lg" [routerLink]="['/investigations', id(), 'verdict']"
              >Back to the verdict</a
            >
          </section>
        } @else {
          @if (!packetCount() && !focused()) {
            <section class="page page--reading">
              <h2>No Bluetooth traffic yet</h2>
              <p>Your answers are kept in the record.</p>
              <a class="btn btn--lg" [routerLink]="['/investigations', id(), 'verdict']"
                >Back to the verdict</a
              >
            </section>
          }
          @if (rows().length) {
            <ol class="ev-list" aria-label="Evidence entries">
              @for (row of rows(); track row.id) {
                <li class="ev" [id]="row.id">
                  <div class="ev__line">
                    <time
                      class="ev__time"
                      [attr.datetime]="(row.at | date: 'yyyy-MM-ddTHH:mm:ss.SSS' : 'UTC') + 'Z'"
                    >
                      {{ row.at | date: 'HH:mm:ss.SSS' }}
                    </time>
                    <span
                      [class]="'ev__dir ev__dir--' + row.author.toLowerCase()"
                      aria-hidden="true"
                    >
                      {{ row.author === 'Sent' ? '→' : row.author === 'Received' ? '←' : '•' }}
                    </span>
                    <div class="ev__body">
                      <span class="visually-hidden">{{ row.author }}</span>
                      @if (row.packet; as packet) {
                        <p class="ev__char">{{ packetTitle(packet) }}</p>
                        @if (packet.hex) {
                          <p class="ev__hex">{{ packet.hex }}</p>
                        }
                        @if (packet.detail) {
                          <p class="ev__text">
                            <bdi>{{ packet.detail }}</bdi>
                          </p>
                        }
                        @if (packet.decoded?.length) {
                          <p class="ev__text">
                            @for (field of packet.decoded; track $index) {
                              @if (!$first) {
                                ·
                              }
                              {{ field.label }} {{ field.value | number: '1.0-3' }} {{ field.unit }}
                            }
                          </p>
                        }
                        @if (packet.approvalId) {
                          <p class="ev__text">Approval {{ packet.approvalId }}</p>
                        }
                      } @else {
                        <p class="ev__text">
                          <bdi>{{ row.text }}</bdi>
                        </p>
                        @if (row.evidence?.length && !focused()) {
                          <a
                            class="btn btn--ghost"
                            [routerLink]="['/investigations', id(), 'evidence']"
                            [queryParams]="{ ref: row.id }"
                            (click)="pickFilter('All')"
                            >Evidence</a
                          >
                        }
                      }
                    </div>
                  </div>
                </li>
              }
            </ol>
            @if (pageNumber() || more()) {
              <nav class="toolbar" aria-label="Evidence pages">
                <div class="chips">
                  <button
                    class="btn"
                    type="button"
                    [disabled]="!pageNumber()"
                    (click)="pageNumber.update(previousPage)"
                  >
                    Previous entries
                  </button>
                  <button
                    class="btn"
                    type="button"
                    [disabled]="!more()"
                    (click)="pageNumber.update(nextPage)"
                  >
                    Next entries
                  </button>
                </div>
              </nav>
            }
          } @else if (packetCount() || focused()) {
            <section class="page page--reading">
              <h2>No matching entries</h2>
              @if (!focused()) {
                <button type="button" class="btn btn--lg" (click)="pickFilter('All')">
                  Show everything
                </button>
              }
            </section>
          }
        }
      </main>
    </div>
    @if (exporting(); as profileId) {
      <g-export-dialog [profileId]="profileId" (closed)="exporting.set(null)" />
    }
  `,
})
export class EvidencePage {
  readonly id = input.required<string>();
  readonly ref = input<string | readonly string[]>();
  private readonly store = inject(InvestigationStore);
  private readonly attempts = signal(0);
  protected readonly record = signal<InvestigationRecord | null>(null);
  protected readonly packetCount = signal(0);
  protected readonly rows = signal<readonly EvidenceRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly focused = computed(() => !!this.ref());
  protected readonly exporting = signal<string | null>(null);
  protected readonly filters = EVIDENCE_FILTERS;
  protected readonly selectedFilter = signal<EvidenceFilter>('All');
  protected readonly pageNumber = signal(0);
  protected readonly more = signal(false);
  protected readonly previousPage = (page: number) => Math.max(0, page - 1);
  protected readonly nextPage = (page: number) => page + 1;

  constructor() {
    effect((cleanup) => {
      const controller = new AbortController();
      cleanup(() => controller.abort());
      this.attempts();
      void this.load(
        this.id(),
        this.ref(),
        this.selectedFilter(),
        this.pageNumber(),
        controller.signal,
      );
    });
  }

  protected retry(): void {
    this.attempts.update((count) => count + 1);
  }

  protected pickFilter(filter: EvidenceFilter): void {
    this.pageNumber.set(0);
    this.selectedFilter.set(filter);
  }

  protected packetTitle(packet: RawLogEntry): string {
    const uuids = [packet.service, packet.uuid].filter((uuid): uuid is string => !!uuid);
    return [...uuids.map(shortUuid), packet.kind].join(' · ');
  }

  private async load(
    id: string,
    reference: string | readonly string[] | undefined,
    filter: EvidenceFilter,
    page: number,
    signal: AbortSignal,
  ): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const [record, count] = await Promise.all([this.store.get(id), this.store.rawLogCount(id)]);
      if (signal.aborted) return;
      this.record.set(record);
      this.packetCount.set(count);
      const result = await readEvidencePage(this.store, record, reference, filter, page, signal);
      if (!signal.aborted) {
        this.rows.set(result.rows);
        this.more.set(result.more);
      }
    } catch {
      if (!signal.aborted) this.failed.set(true);
    } finally {
      if (!signal.aborted) this.loading.set(false);
    }
  }
}
