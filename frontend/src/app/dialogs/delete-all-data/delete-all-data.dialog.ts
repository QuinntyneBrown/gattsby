import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { LocalDataCounts } from '../../store/model/local-data-counts';

@Component({
  selector: 'g-delete-all-data-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../native-dialog.css',
  styles: `
    .dialog__body {
      display: grid;
      gap: var(--space-3);
    }
  `,
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="delete-data-title"
      aria-describedby="delete-data-description"
      (cancel)="cancel($event)"
    >
      <div class="dialog__panel dialog__panel--danger">
        <div class="dialog__grabber" aria-hidden="true"></div>
        <div class="dialog__header">
          <h2 class="dialog__title" id="delete-data-title">Delete all data?</h2>
        </div>
        <div class="dialog__body">
          <p class="dialog__lead" id="delete-data-description">
            This removes every investigation, device profile, photo and setting Gattsby holds on
            this device. It can’t be undone. Export anything you want to keep first.
          </p>
          <p>
            {{ counts().investigations }}
            {{ counts().investigations === 1 ? 'investigation' : 'investigations' }} ·
            {{ counts().profiles }}
            {{ counts().profiles === 1 ? 'device profile' : 'device profiles' }} ·
            {{ counts().photos }} {{ counts().photos === 1 ? 'photo' : 'photos' }}
          </p>
          <label for="delete-confirmation">Type DELETE in capitals to confirm.</label>
          <input
            #confirmation
            id="delete-confirmation"
            class="input"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            [disabled]="busy()"
            [attr.aria-invalid]="touched() && value() !== 'DELETE' ? 'true' : null"
            (input)="value.set(confirmation.value)"
            (blur)="touched.set(true)"
          />
          @if (blocked()) {
            <p role="status">Close Gattsby’s other tabs to finish deleting the data.</p>
          } @else if (busy()) {
            <p role="status">Deleting data from this device…</p>
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
            [disabled]="busy() || value() !== 'DELETE'"
            (click)="confirm()"
          >
            Delete all data
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class DeleteAllDataDialog {
  readonly counts = input.required<LocalDataCounts>();
  readonly busy = input(false);
  readonly blocked = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly confirmed = output<void>();
  protected readonly value = signal('');
  protected readonly touched = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly safe = viewChild.required<ElementRef<HTMLButtonElement>>('safe');

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.safe().nativeElement.focus();
    });
  }

  protected confirm(): void {
    if (!this.busy() && this.value() === 'DELETE') this.confirmed.emit();
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    this.dialog().nativeElement.close();
    this.closed.emit();
  }
}
