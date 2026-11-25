import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { ExportService } from '../../store/export-service';
import { InvestigationStore } from '../../store/investigation-store';

@Component({
  selector: 'g-export-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './export.dialog.html',
  styles: `
    dialog {
      border: 0;
      margin: 0;
      max-width: none;
      max-height: none;
      width: 100%;
      height: 100%;
      background: transparent;
    }
    dialog:not([open]) {
      display: none;
    }
    dialog::backdrop {
      background: var(--color-bg-backdrop);
    }
    .dialog__panel {
      overflow-wrap: anywhere;
    }
  `,
})
export class ExportDialog {
  readonly profileId = input.required<string>();
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly store = inject(InvestigationStore);
  private readonly exporter = inject(ExportService);
  protected readonly profile = resource({
    params: () => this.profileId(),
    loader: ({ params }) => this.store.getProfile(params),
  });
  protected readonly busy = signal(false);
  protected readonly saved = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    this.dialog().nativeElement.close();
    this.closed.emit();
  }

  protected async run(kind: 'profile' | 'summary'): Promise<void> {
    if (this.busy() || !this.profile.hasValue()) return;
    this.busy.set(true);
    this.failed.set(false);
    this.copied.set(false);
    try {
      if (kind === 'profile') {
        this.saved.set(await this.exporter.exportProfile(this.profile.value()));
      } else {
        await this.exporter.copySummary(this.profile.value());
        this.copied.set(true);
      }
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
