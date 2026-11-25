import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PlaybookOrchestrator } from '../../agent/playbook-orchestrator';
import { ConfirmationCheck } from '../../agent/confirmation-check';
import { PromptChannel } from '../../agent/prompt-channel';
import { LiveMetrics } from '../../live/live-metrics';
import { NotificationRecorder } from '../../tools/listening/notification-recorder';
import { confidenceWord } from '../../outcome/confidence-scorer';
import { shortUuid } from '../../knowledge-base/uuid';
import { ActivityFeedComponent } from '../../ui/activity-feed/activity-feed.component';
import { ConfidenceBadgeComponent } from '../../ui/confidence-badge/confidence-badge.component';
import { EmergencyStopButtonComponent } from '../../ui/emergency-stop-button/emergency-stop-button.component';
import {
  PromptCardComponent,
  type PromptCardResponse,
} from '../../ui/prompt-card/prompt-card.component';
import { StageTrackComponent } from '../../ui/stage-track/stage-track.component';

// The Investigation page at /investigations/:id (docs/mocks/pages/investigation/*.html). It runs
// the playbook through its own orchestrator, so leaving the page releases the connection and the
// investigation's memory (FR-018, NFR-005).
@Component({
  selector: 'g-investigation-page',
  imports: [
    RouterLink,
    ActivityFeedComponent,
    ConfidenceBadgeComponent,
    EmergencyStopButtonComponent,
    PromptCardComponent,
    StageTrackComponent,
  ],
  providers: [
    PlaybookOrchestrator,
    PromptChannel,
    LiveMetrics,
    NotificationRecorder,
    ConfirmationCheck,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
    .reading {
      min-height: 48px;
    }
    .reading__label {
      display: block;
    }
  `,
  template: `
    <div class="app app--fixed">
      <header class="appbar">
        <a class="btn btn--ghost btn--icon" routerLink="/" aria-label="Leave the investigation">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </a>
        <div class="appbar__titles">
          <h1 class="appbar__title">
            <bdi>{{ title() }}</bdi>
          </h1>
          <p class="appbar__subtitle">{{ subtitle() }}</p>
        </div>
        <div class="appbar__actions">
          @if (connected()) {
            <g-emergency-stop-button (pressed)="orchestrator.stop('emergencyStop')" />
          }
        </div>
      </header>
      <g-stage-track [stages]="orchestrator.stageStates()" />
      <main id="main" class="inv" tabindex="-1">
        <div class="hypo-strip">
          <span class="hypo-strip__label">Hypothesis</span>
          <span class="hypo-strip__value">{{ hypothesis()?.label ?? 'None yet' }}</span>
          @if (hypothesis(); as h) {
            <span class="meter">
              <span
                class="meter__track"
                role="progressbar"
                aria-label="Confidence"
                [attr.aria-valuenow]="percent()"
                aria-valuemin="0"
                aria-valuemax="100"
                ><span class="meter__fill" [style.--value]="percent() + '%'"></span
              ></span>
              <span class="meter__value">{{ percent() }}%</span>
            </span>
          }
        </div>
        <section
          class="inv__feed"
          aria-label="Activity"
          [attr.aria-busy]="loading() ? 'true' : null"
        >
          <div class="feed-scroll" #feedScroll>
            <div class="feed-wrap">
              <g-activity-feed [entries]="orchestrator.feed()" />
            </div>
          </div>
        </section>
        <section class="inv__prompt dock" aria-labelledby="prompt-title" aria-live="polite">
          @switch (orchestrator.status()) {
            @case ('paused') {
              <div class="dock__inner">
                <p class="prompt__eyebrow">Interrupted</p>
                <h2 class="prompt__title" id="prompt-title">This investigation was interrupted</h2>
                <p class="prompt__detail">
                  Everything up to step {{ orchestrator.investigation()?.lastCommittedStep }} is
                  saved.
                </p>
                <div class="prompt__actions">
                  <a class="btn btn--primary btn--lg" routerLink="/">Back to home</a>
                </div>
              </div>
            }
            @case ('error') {
              <div class="dock__inner">
                <h2 class="prompt__title" id="prompt-title">Gattsby stopped this investigation</h2>
                <p class="prompt__detail">
                  Something went wrong in Gattsby itself. Everything so far is saved.
                </p>
                <div class="prompt__actions">
                  <a class="btn btn--primary btn--lg" routerLink="/">Back to home</a>
                </div>
              </div>
            }
            @default {
              @if (metrics().length > 0) {
                <div class="dock__inner" aria-live="off">
                  <div class="live-strip" aria-label="Live readings">
                    @for (field of metrics(); track field.metric) {
                      <div class="reading">
                        <span class="reading__label">{{ field.label }}</span>
                        <span class="reading__value">{{
                          metricValue(field.value, field.scale)
                        }}</span>
                        <span class="reading__unit">{{ field.unit }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
              <g-prompt-card
                [prompt]="prompts.current()"
                [running]="orchestrator.running()"
                (respond)="respond($event)"
                (stop)="orchestrator.stop('personStop')"
              />
            }
          }
        </section>
        <aside class="inv__panel" aria-label="Hypothesis, live readings and device">
          <section>
            <p class="panel-section__label">Hypothesis</p>
            <p class="panel-hypo">{{ hypothesis()?.label ?? 'None yet' }}</p>
            @if (hypothesis(); as h) {
              <div class="meter meter--lg" style="margin-top: var(--space-3)">
                <span
                  class="meter__track"
                  role="progressbar"
                  aria-label="Confidence"
                  [attr.aria-valuenow]="percent()"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  ><span class="meter__fill" [style.--value]="percent() + '%'"></span
                ></span>
                <span class="meter__value">{{ percent() }}%</span>
                <g-confidence-badge [word]="word()" />
              </div>
            } @else {
              <p class="text-muted text-sm" style="margin-top: var(--space-2)">
                Forms after the first connection.
              </p>
            }
          </section>
          <section>
            <h2 class="section-title">Live readings</h2>
            @if (metrics().length > 0) {
              <dl class="readings">
                @for (field of metrics(); track field.metric) {
                  <div class="readings__row">
                    <dt>{{ field.label }}</dt>
                    <dd class="readings__value">
                      {{ metricValue(field.value, field.scale) }} {{ field.unit }}
                    </dd>
                  </div>
                }
              </dl>
            } @else {
              <p class="text-muted text-sm" style="margin-top: var(--space-2)">
                Appear here once the machine is moving.
              </p>
            }
          </section>
          <section>
            <h2 class="section-title">Device</h2>
            <dl class="kv">
              <dt>Advertised name</dt>
              <dd>
                <bdi>{{ deviceName() ?? '—' }}</bdi>
              </dd>
              <dt>Maker</dt>
              <dd>
                <bdi>{{ deviceInfo()?.manufacturer ?? '—' }}</bdi>
              </dd>
              <dt>Model</dt>
              <dd>
                <bdi>{{ deviceInfo()?.model ?? '—' }}</bdi>
              </dd>
              <dt>Firmware</dt>
              <dd>
                <bdi>{{ deviceInfo()?.firmware ?? '—' }}</bdi>
              </dd>
              <dt>Services</dt>
              <dd class="mono">{{ services() }}</dd>
            </dl>
          </section>
        </aside>
      </main>
    </div>
  `,
})
export class InvestigationPage implements OnInit, OnDestroy {
  readonly id = input.required<string>();
  protected readonly orchestrator = inject(PlaybookOrchestrator);
  protected readonly prompts = inject(PromptChannel);
  protected readonly metrics = inject(LiveMetrics).metrics;
  private readonly router = inject(Router);
  private readonly feedScroll = viewChild<ElementRef<HTMLElement>>('feedScroll');

  protected readonly loading = computed(() => this.orchestrator.status() === 'loading');
  protected readonly connected = computed(
    () => this.orchestrator.connection().status === 'connected',
  );
  protected readonly hypothesis = this.orchestrator.hypothesis;
  protected readonly percent = computed(() =>
    Math.round((this.hypothesis()?.confidence ?? 0) * 100),
  );
  protected readonly word = computed(() => confidenceWord(this.hypothesis()?.confidence ?? 0));
  protected readonly deviceName = computed(() => this.orchestrator.state().device?.name ?? null);
  protected readonly deviceInfo = computed(() => {
    const info = this.orchestrator.state().deviceInfo;
    return info && info !== 'absent' ? info : null;
  });
  protected readonly services = computed(
    () =>
      this.orchestrator
        .state()
        .layout?.map((s) => shortUuid(s.uuid))
        .join(' ') || '—',
  );
  protected readonly title = computed(() => {
    const device = this.orchestrator.state().device;
    return device ? (device.name ?? 'Unnamed device') : 'New investigation';
  });
  protected readonly subtitle = computed(
    () =>
      `${this.orchestrator.mode() === 'checklist' ? 'Checklist' : 'Agent'} · ${
        this.orchestrator.stageStates().find((s) => s.state === 'now')?.name ?? ''
      }`,
  );

  constructor() {
    effect(() => {
      this.orchestrator.feed();
      const scroll = this.feedScroll()?.nativeElement;
      if (scroll) queueMicrotask(() => scroll.scrollTo({ top: scroll.scrollHeight }));
    });
  }

  ngOnInit(): void {
    void this.orchestrator.open(this.id()).then(() => {
      const investigation = this.orchestrator.investigation();
      if (
        this.orchestrator.status() === 'concluded' &&
        investigation?.verdict &&
        !this.router.url.endsWith('/verdict')
      ) {
        void this.router.navigate(['/investigations', investigation.id, 'verdict'], {
          replaceUrl: true,
        });
      }
    });
  }

  ngOnDestroy(): void {
    void this.orchestrator.leave();
  }

  protected respond(response: PromptCardResponse): void {
    this.prompts.respond(response);
  }

  protected metricValue(value: number, scale: number): string {
    return value.toFixed(scale < 1 ? 1 : 0);
  }
}
