import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'g-delete-investigation-dialog',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../native-dialog.css',
  styles: `
    .dialog__title {
      overflow-wrap: anywhere;
    }
  `,
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="delete-investigation-title"
      aria-describedby="delete-investigation-description"
      (cancel)="cancel($event)"
    >
      <div class="dialog__panel dialog__panel--danger">
        <div class="dialog__grabber" aria-hidden="true"></div>
        <div class="dialog__header">
          <h2 class="dialog__title" id="delete-investigation-title">
            Delete “<bdi>{{ deviceName() }}</bdi
            >”?
          </h2>
        </div>
        <div class="dialog__body">
          <p class="dialog__lead" id="delete-investigation-description">
            This deletes the investigation from {{ startedAt() | date: 'EEE d MMM' }} with its raw
            log, photos and device profile. It can’t be undone. Export it first if you might need
            it.
          </p>
          @if (busy()) {
            <p role="status">Deleting the investigation…</p>
          }
          @if (error()) {
            <p role="alert">{{ error() }}</p>
          }
        </div>
        <div class="dialog__footer">
          <button #safe class="btn btn--lg" type="button" [disabled]="busy()" (click)="cancel()">
            Cancel
          </button>
          <button
            class="btn btn--danger btn--lg"
            type="button"
            [disabled]="busy()"
            (click)="confirmed.emit()"
          >
            Delete investigation
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class DeleteInvestigationDialog {
  readonly deviceName = input.required<string>();
  readonly startedAt = input.required<number>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly confirmed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly safe = viewChild.required<ElementRef<HTMLButtonElement>>('safe');

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.safe().nativeElement.focus();
    });
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    this.dialog().nativeElement.close();
    this.closed.emit();
  }
}
