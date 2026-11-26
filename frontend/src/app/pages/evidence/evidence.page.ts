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
              {{ saved.steps.length }} steps
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
          @if (focused()) {
            <div class="toolbar">
              <span>Selected evidence</span>
              <a class="btn btn--ghost" [routerLink]="['/investigations', id(), 'evidence']"
                >Show everything</a
              >
            </div>
          }
          @if (packets().length) {
            <ol class="ev-list" aria-label="Evidence entries">
              @for (packet of packets(); track packet.id) {
                <li class="ev" [id]="packet.id">
                  <div class="ev__line">
                    <time
                      class="ev__time"
                      [attr.datetime]="(packet.t | date: 'yyyy-MM-ddTHH:mm:ss.SSS' : 'UTC') + 'Z'"
                    >
                      {{ packet.t | date: 'HH:mm:ss.SSS' }}
                    </time>
                    @if (packet.direction === 'out') {
                      <span class="ev__dir ev__dir--sent" aria-hidden="true">→</span>
                    } @else {
                      <span class="ev__dir ev__dir--received" aria-hidden="true">←</span>
                    }
                    <div class="ev__body">
                      <span class="visually-hidden">{{
                        packet.direction === 'out' ? 'Sent' : 'Received'
                      }}</span>
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
                    </div>
                  </div>
                </li>
              }
            </ol>
          } @else {
            <section class="page page--reading">
              <h2>{{ focused() ? 'No matching entries' : 'No Bluetooth traffic yet' }}</h2>
              <p>Your answers are kept in the record.</p>
              <a class="btn btn--lg" [routerLink]="['/investigations', id(), 'verdict']"
                >Back to the verdict</a
              >
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
  readonly ref = input<string>();
  private readonly store = inject(InvestigationStore);
  private readonly attempts = signal(0);
  protected readonly record = signal<InvestigationRecord | null>(null);
  protected readonly packets = signal<readonly RawLogEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly focused = computed(() => !!this.ref());
  protected readonly exporting = signal<string | null>(null);

  constructor() {
    effect((cleanup) => {
      const controller = new AbortController();
      cleanup(() => controller.abort());
      this.attempts();
      void this.load(this.id(), this.ref(), controller.signal);
    });
  }

  protected retry(): void {
    this.attempts.update((count) => count + 1);
  }

  protected packetTitle(packet: RawLogEntry): string {
    const uuids = [packet.service, packet.uuid].filter((uuid): uuid is string => !!uuid);
    return [...uuids.map(shortUuid), packet.kind].join(' · ');
  }

  private async load(
    id: string,
    reference: string | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const record = await this.store.get(id);
      if (signal.aborted) return;
      this.record.set(record);
      let rows: readonly RawLogEntry[] = [];
      if (reference) {
        const observation = record.observations.find(({ id }) => id === reference);
        rows = await this.store.rawEvidence(id, observation?.evidence ?? [reference]);
      } else {
        for await (const page of this.store.rawLogPages(id)) {
          rows = page;
          break;
        }
      }
      if (!signal.aborted) this.packets.set([...rows].sort((a, b) => a.seq - b.seq));
    } catch {
      if (!signal.aborted) this.failed.set(true);
    } finally {
      if (!signal.aborted) this.loading.set(false);
    }
  }
}
