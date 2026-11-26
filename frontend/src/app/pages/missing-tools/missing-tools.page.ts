import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { KnowledgeBase } from '../../knowledge-base/knowledge-base';
import type { MissingToolGroup } from '../../outcome/missing-tool-group';
import { MissingToolsService } from '../../outcome/missing-tools.service';
import { ExportService } from '../../store/export-service';

@Component({
  selector: 'g-missing-tools-page',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
    .requests {
      list-style: none;
      padding: 0;
      margin: var(--space-6) 0 0;
    }
    .req__title,
    .req__text,
    .req__meta {
      overflow-wrap: anywhere;
    }
    .req__meta a {
      display: inline-flex;
      align-items: center;
      min-height: var(--target-min);
    }
  `,
  template: `
    <div class="app">
      <header class="appbar">
        <a class="btn btn--ghost btn--icon" routerLink="/" aria-label="Back">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </a>
        <div class="appbar__titles">
          <h1 class="appbar__title">Missing tools</h1>
          @if (groups(); as loaded) {
            <p class="appbar__subtitle">
              {{
                loaded.length
                  ? openCount() + ' open · raised by the agent when it got stuck'
                  : 'None raised yet'
              }}
            </p>
          }
        </div>
        @if (groups()?.length) {
          <button
            class="btn btn--ghost"
            type="button"
            [disabled]="exporting()"
            (click)="exportJson()"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span class="hide-sm">Export JSON</span
            ><span class="visually-hidden show-sm-only">Export JSON</span>
          </button>
        }
      </header>
      <main id="main" class="page page--reading" tabindex="-1" [attr.aria-busy]="loading()">
        @if (notice(); as message) {
          <p class="text-muted" role="status">{{ message }}</p>
        }
        @if (loading()) {
          <p class="text-muted" role="status">Loading missing-tool requests…</p>
        } @else if (failed()) {
          <section class="empty">
            <h2>Couldn’t read the requests</h2>
            <p>Chrome didn’t answer when Gattsby opened its storage. Nothing has been lost.</p>
            <button class="btn btn--primary btn--lg" type="button" (click)="load()">
              Try again
            </button>
            <a class="btn btn--lg" routerLink="/">Back to home</a>
          </section>
        } @else if (groups()?.length) {
          <p class="text-muted">
            Each request names a capability the agent lacked and the evidence it saved.
          </p>
          <ul class="requests">
            @for (group of groups(); track group.capabilityKey) {
              <li class="req" [class.req--built]="group.status === 'built'">
                <div class="req__head">
                  <h2 class="req__title">
                    <bdi>{{ group.capability }}</bdi>
                  </h2>
                  @if (group.status === 'open') {
                    <span class="pill pill--open"
                      >Open · {{ group.count }} {{ group.count === 1 ? 'device' : 'devices' }}</span
                    >
                  } @else {
                    <span class="pill pill--built">Built</span>
                  }
                </div>
                <p class="req__text">
                  <bdi>{{ group.latestReason }}</bdi>
                </p>
                <p class="req__meta">
                  @for (investigation of group.investigations; track investigation.id) {
                    <a
                      [routerLink]="[
                        '/investigations',
                        investigation.id,
                        investigation.hasVerdict ? 'verdict' : 'evidence',
                      ]"
                    >
                      <bdi>{{ investigation.deviceName }}</bdi> </a
                    >{{ $last ? '' : ', ' }}
                  }
                  · first raised {{ group.firstRaisedAt | date: 'MMM d' }}
                </p>
              </li>
            }
          </ul>
        } @else {
          <section class="empty">
            <h2>No missing tools</h2>
            <p>
              When the agent needs a capability it doesn’t have, it records a request here with the
              evidence.
            </p>
            <a class="btn btn--primary btn--lg" routerLink="/">Back to home</a>
          </section>
        }
      </main>
    </div>
  `,
})
export class MissingToolsPage implements OnInit {
  private readonly exports = inject(ExportService);
  private readonly missingTools = inject(MissingToolsService);
  private readonly knowledgeBase = inject(KnowledgeBase);
  protected readonly groups = signal<readonly MissingToolGroup[] | null>(null);
  protected readonly openCount = computed(
    () => this.groups()?.filter(({ status }) => status === 'open').length ?? 0,
  );
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly exporting = signal(false);
  protected readonly notice = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.groups.set(await this.missingTools.list());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected async exportJson(): Promise<void> {
    const groups = this.groups();
    if (!groups?.length || this.exporting()) return;
    this.exporting.set(true);
    this.notice.set(null);
    try {
      const kb = await this.knowledgeBase.load();
      const name = await this.exports.exportMissingTools(groups, kb.version);
      this.notice.set(`Exported ${name}.`);
    } catch {
      this.notice.set('Couldn’t export the requests. Try again.');
    } finally {
      this.exporting.set(false);
    }
  }
}
