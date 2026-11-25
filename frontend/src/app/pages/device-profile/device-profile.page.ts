import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { InvestigationStarter } from '../../agent/investigation-starter';
import { ExportDialog } from '../../dialogs/export/export.dialog';
import { shortUuid } from '../../knowledge-base/uuid';
import { InvestigationStore } from '../../store/investigation-store';
import { ConfidenceBadgeComponent } from '../../ui/confidence-badge/confidence-badge.component';
import { VerdictMarkComponent } from '../../ui/verdict-mark/verdict-mark.component';

@Component({
  selector: 'g-device-profile-page',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    ConfidenceBadgeComponent,
    VerdictMarkComponent,
    ExportDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
    .profile-main,
    .profile-aside {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    section,
    .investigate {
      margin-top: var(--space-8);
    }
    .table-scroll {
      overflow-x: auto;
    }
  `,
  templateUrl: './device-profile.page.html',
})
export class DeviceProfilePage {
  readonly id = input.required<string>();
  private readonly store = inject(InvestigationStore);
  private readonly starter = inject(InvestigationStarter);
  private readonly router = inject(Router);
  protected readonly profile = resource({
    params: () => this.id(),
    loader: ({ params }) => this.store.getProfile(params),
  });
  protected readonly recordHeader = resource({
    params: () => (this.profile.hasValue() ? this.profile.value().investigationId : undefined),
    loader: ({ params }) => this.store.getInvestigation(params),
  });
  protected readonly starting = signal(false);
  protected readonly startFailed = signal(false);
  protected readonly exporting = signal(false);
  protected readonly shortUuid = shortUuid;
  protected readonly statusWords = {
    confirmed: 'confirmed',
    likely: 'likely',
    claimedOnly: 'claimed only',
    claimedNotSeen: 'claimed, not seen',
    refused: 'refused',
  };

  protected async investigateAgain(): Promise<void> {
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
