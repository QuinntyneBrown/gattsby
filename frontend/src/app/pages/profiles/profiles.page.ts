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
import { InvestigationStore } from '../../store/investigation-store';
import type { DeviceProfile } from '../../store/model/device-profile';
import { VerdictMarkComponent } from '../../ui/verdict-mark/verdict-mark.component';

const DEVICE_FILTERS = [
  { name: 'All', type: '' },
  { name: 'Treadmill', type: 'treadmill' },
  { name: 'Spin bike', type: 'bike' },
  { name: 'Rower', type: 'rower' },
  { name: 'Heart-rate strap', type: 'heart-rate-sensor' },
  { name: 'Smart trainer', type: 'smart-trainer' },
] as const;

@Component({
  selector: 'g-profiles-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, VerdictMarkComponent],
  styles: `
    :host {
      display: contents;
    }
    .profiles {
      width: 100%;
      max-width: 48rem;
      margin-inline: auto;
    }
    .row {
      padding-inline: var(--layout-margin);
    }
    .row__title,
    .row__meta {
      overflow-wrap: anywhere;
    }
  `,
  template: `
    <div class="app">
      <header class="appbar">
        <a class="btn btn--ghost btn--icon" routerLink="/" aria-label="Back">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </a>
        <div class="appbar__titles">
          <h1 class="appbar__title">Saved devices</h1>
          @if (!loading() && !failed()) {
            <p class="appbar__subtitle">
              {{
                profiles().length
                  ? profiles().length + ' profiles on this device'
                  : 'Nothing saved yet'
              }}
            </p>
          }
        </div>
      </header>
      <main id="main" class="profiles" tabindex="-1" [attr.aria-busy]="loading()">
        @if (loading()) {
          <p class="page page--reading" role="status">Loading saved devices…</p>
        } @else if (failed()) {
          <section class="page page--reading empty">
            <h2>Couldn’t read saved devices</h2>
            <p>Chrome didn’t answer when Gattsby opened its storage. Nothing has been lost.</p>
            <button class="btn btn--primary btn--lg" type="button" (click)="load()">
              Try again
            </button>
            <a class="btn btn--lg" routerLink="/">Back to home</a>
          </section>
        } @else {
          @if (profiles().length) {
            <div class="toolbar">
              <label class="visually-hidden" for="profile-search">Search saved devices</label>
              <input
                #search
                class="input"
                id="profile-search"
                type="search"
                placeholder="Search brand, model or protocol"
                [value]="query()"
                (input)="query.set(search.value)"
              />
              <div class="chips" role="group" aria-label="Device type">
                @for (filter of filters; track filter.type) {
                  <button
                    class="chip"
                    type="button"
                    [attr.aria-pressed]="deviceType() === filter.type"
                    (click)="deviceType.set(filter.type)"
                  >
                    {{ filter.name }}
                  </button>
                }
              </div>
            </div>
          }
          @if (filtered().length) {
            <ul class="rows rows--flush" aria-label="Saved devices">
              @for (profile of filtered(); track profile.id) {
                <li>
                  <a class="row" [routerLink]="['/profiles', profile.id]">
                    <g-verdict-mark [kind]="profile.verdict.kind" />
                    <span class="row__body">
                      <span class="row__title"
                        ><bdi>{{ profile.identity.displayName }}</bdi></span
                      >
                      <span class="row__meta">
                        {{ profile.verdict.label }}
                        @if (profile.protocol?.variant; as variant) {
                          · <bdi>{{ variant }}</bdi>
                        }
                      </span>
                      <span class="row__meta row__meta--xs">
                        {{ profile.createdAt | date: 'EEE d MMM' }}
                        @if (profile.location) {
                          · <bdi>{{ profile.location }}</bdi>
                        }
                      </span>
                    </span>
                    <svg class="icon row__chevron" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </a>
                </li>
              }
            </ul>
          } @else {
            <section class="page page--reading empty">
              @if (profiles().length) {
                <h2>
                  Nothing saved matches{{
                    query().trim() ? ' “' + query().trim() + '”' : ' this filter'
                  }}.
                </h2>
                <button class="btn btn--lg" type="button" (click)="clearSearch()">
                  Clear search
                </button>
              } @else {
                <h2>No saved devices yet</h2>
                <p>Each completed investigation saves a device profile with its verdict.</p>
              }
              <button
                class="btn btn--primary btn--lg"
                type="button"
                [disabled]="starting()"
                (click)="identify()"
              >
                Identify a device
              </button>
              @if (startFailed()) {
                <p role="alert">Couldn’t start an investigation. Try again.</p>
              }
            </section>
          }
        }
      </main>
    </div>
  `,
})
export class ProfilesPage implements OnInit {
  private readonly store = inject(InvestigationStore);
  private readonly starter = inject(InvestigationStarter);
  private readonly router = inject(Router);
  protected readonly profiles = signal<readonly DeviceProfile[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly starting = signal(false);
  protected readonly startFailed = signal(false);
  protected readonly filters = DEVICE_FILTERS;
  protected readonly query = signal('');
  protected readonly deviceType = signal<string>('');
  protected readonly filtered = computed(() => {
    const query = this.query().normalize('NFKC').trim().toLowerCase();
    const deviceType = this.deviceType();
    return this.profiles().filter(({ identity, protocol }) => {
      if (deviceType && identity.deviceType !== deviceType) return false;
      return (
        !query ||
        [
          identity.displayName,
          identity.advertisedName,
          identity.maker,
          identity.model,
          protocol?.name,
          protocol?.variant,
        ].some((value) => value?.normalize('NFKC').toLowerCase().includes(query))
      );
    });
  });

  ngOnInit(): void {
    void this.load();
  }

  protected clearSearch(): void {
    this.query.set('');
    this.deviceType.set('');
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.profiles.set(await this.store.listProfiles());
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
}
