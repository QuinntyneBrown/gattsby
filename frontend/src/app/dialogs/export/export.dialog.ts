import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { ExportService } from '../../store/export-service';
import { exportFileName } from '../../store/file-namer';
import { InvestigationStore } from '../../store/investigation-store';
import type { VerdictCommit } from '../../store/model/verdict-commit';

@Component({
  selector: 'g-export-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './export.dialog.html',
  styleUrl: '../native-dialog.css',
  styles: `
    .dialog__panel {
      overflow-wrap: anywhere;
    }
  `,
})
export class ExportDialog {
  readonly profileId = input.required<string>();
  readonly pendingVerdict = input<VerdictCommit | null>(null);
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly store = inject(InvestigationStore);
  private readonly exporter = inject(ExportService);
  private readonly lifetime = new AbortController();
  protected readonly profile = resource({
    params: () => ({ id: this.profileId(), pending: this.pendingVerdict() }),
    loader: async ({ params }) => params.pending?.profile ?? this.store.getProfile(params.id),
  });
  protected readonly busy = signal(false);
  protected readonly preparing = signal<string | null>(null);
  protected readonly includeNotesAndPhotos = signal(false);
  protected readonly sizes = resource({
    params: () => (this.profile.hasValue() ? this.profile.value() : undefined),
    loader: ({ params }) => this.exporter.estimateSizes(params),
  });
  protected readonly saved = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.lifetime.abort());
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    this.dialog().nativeElement.close();
    this.closed.emit();
  }

  protected sizeLabel(bytes: number): string {
    return bytes >= 1_000_000
      ? `${(bytes / 1_000_000).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1000))} KB`;
  }

  protected async run(kind: 'profile' | 'record' | 'summary'): Promise<void> {
    if (this.busy() || !this.profile.hasValue()) return;
    this.busy.set(true);
    this.failed.set(false);
    this.copied.set(false);
    try {
      if (kind === 'summary') {
        await this.exporter.copySummary(this.profile.value());
        this.copied.set(true);
      } else {
        const profile = this.profile.value();
        const include = this.includeNotesAndPhotos();
        const signal = this.lifetime.signal;
        if (this.sizes.hasValue()) {
          this.preparing.set(
            exportFileName(profile.identity.displayName, this.sizes.value().startedAt, kind),
          );
        }
        this.saved.set(
          await (kind === 'profile'
            ? this.exporter.exportProfile(profile, include, signal)
            : this.exporter.exportRecord(
                profile,
                include,
                signal,
                this.pendingVerdict() ?? undefined,
              )),
        );
      }
    } catch {
      this.failed.set(true);
    } finally {
      this.preparing.set(null);
      this.busy.set(false);
    }
  }
}
