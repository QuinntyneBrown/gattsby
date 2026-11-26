import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { InvestigationStarter } from '../../agent/investigation-starter';
import { CapabilityDetector } from '../../environment/capability-detector';
import { ModeSelector } from '../../environment/mode-selector';
import { InvestigationStore } from '../../store/investigation-store';
import type { Investigation } from '../../store/model/investigation';
import { STAGE_NAMES } from '../../agent/stage-names';
import type { DeviceProfile } from '../../store/model/device-profile';
import { BrandComponent } from '../../ui/brand/brand.component';
import { VerdictMarkComponent } from '../../ui/verdict-mark/verdict-mark.component';
import { MissingToolsService } from '../../outcome/missing-tools.service';

// The Home page (docs/mocks/pages/home/empty.html and default.html). "Identify a device" creates
// and stores the investigation before the first prompt (FR-007). The paused investigation, saved
// devices, past investigations and missing-tool requests join with journeys 11, 4, 15 and 14.
@Component({
  selector: 'g-home-page',
  imports: [BrandComponent, DatePipe, RouterLink, VerdictMarkComponent],
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
        <a class="btn btn--ghost btn--icon" routerLink="/settings" aria-label="Settings">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-8 2v4" />
          </svg>
        </a>
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
        @if (dataDeleted()) {
          <p role="status">Data deleted from this device.</p>
        }
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
      @if (resumable().length) {
        <section aria-label="Saved investigations" style="margin-top: var(--space-6)">
          @for (investigation of resumable(); track investigation.id) {
            <a
              class="resume-card"
              [routerLink]="['/investigations', investigation.id]"
              [queryParams]="{ resume: true }"
            >
              <span class="resume-card__icon">
                <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              </span>
              <span class="resume-card__body">
                <span class="resume-card__title"
                  >Resume: <bdi>{{ investigation.deviceName ?? 'New investigation' }}</bdi></span
                >
                <span class="resume-card__meta"
                  >Paused at {{ stageNames[investigation.stage] }} ·
                  {{ investigation.interruptedAt ?? investigation.startedAt | date: 'short' }}</span
                >
              </span>
            </a>
          }
        </section>
      }
      @if (profiles().length) {
        <section aria-label="Saved devices" style="margin-top: var(--space-6)">
          <div class="group__head">
            <h2>Saved devices</h2>
            <a class="btn btn--ghost" routerLink="/profiles" aria-label="View all saved devices"
              >View all</a
            >
          </div>
          <ul class="rows">
            @for (profile of profiles(); track profile.id) {
              <li>
                <a class="row" [routerLink]="['/profiles', profile.id]">
                  <g-verdict-mark [kind]="profile.verdict.kind" />
                  <span class="row__body">
                    <span class="row__title"
                      ><bdi>{{ profile.identity.displayName }}</bdi></span
                    >
                    <span class="row__meta">{{ profile.verdict.label }}</span>
                  </span>
                  <svg class="icon row__chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              </li>
            }
          </ul>
        </section>
      }
      @if (returning()) {
        <a class="row" routerLink="/investigations" style="margin-top: var(--space-6)">
          <span class="row__body">
            <span class="row__title">Past investigations</span>
            <span class="row__meta">{{ investigationCount() }} on this device</span>
          </span>
          <svg class="icon row__chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      }
      @if (returning() && openMissingTools() !== null) {
        <a class="row" routerLink="/missing-tools" style="margin-top: var(--space-6)">
          <span class="row__body">
            <span class="row__title">Missing tools</span>
            <span class="row__meta">{{ openMissingTools() }} open</span>
          </span>
          <svg class="icon row__chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      }
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
  private readonly missingTools = inject(MissingToolsService);
  private readonly router = inject(Router);
  protected readonly returning = signal(false);
  protected readonly dataDeleted = signal(false);
  protected readonly investigationCount = signal(0);
  protected readonly resumable = signal<readonly Investigation[]>([]);
  protected readonly profiles = signal<readonly DeviceProfile[]>([]);
  protected readonly stageNames = STAGE_NAMES;
  protected readonly starting = signal(false);
  protected readonly failed = signal(false);
  protected readonly mode = signal<'agent' | 'checklist' | null>(null);
  protected readonly openMissingTools = signal<number | null>(null);

  ngOnInit(): void {
    const navigation = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
    if (navigation?.extras.info === 'local-data-deleted') {
      this.dataDeleted.set(true);
      return;
    }
    void this.store.listProfiles(4).then(
      (profiles) => this.profiles.set(profiles),
      () => undefined,
    );
    void this.store.list().then(
      (investigations) => {
        this.returning.set(investigations.length > 0);
        this.investigationCount.set(investigations.length);
        this.resumable.set(investigations.filter((row) => !row.verdict && !row.readOnly));
        if (investigations.length) {
          void this.missingTools.list().then(
            (groups) =>
              this.openMissingTools.set(groups.filter(({ status }) => status === 'open').length),
            () => this.openMissingTools.set(null),
          );
        }
      },
      () => this.returning.set(false),
    );
    void this.modes.prefersAgent().then(async (prefersAgent) => {
      const capabilities = await this.capabilities.detect({ model: prefersAgent });
      this.mode.set(this.modes.select(capabilities, prefersAgent));
    });
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
