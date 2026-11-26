import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { EmergencyStopButtonComponent } from '../../ui/emergency-stop-button/emergency-stop-button.component';

@Component({
  selector: 'g-stop-investigation-dialog',
  imports: [EmergencyStopButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../native-dialog.css',
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="stop-investigation-title"
      (cancel)="close($event)"
    >
      <div class="dialog__panel">
        @if (device()) {
          <div class="dialog__toolbar">
            <g-emergency-stop-button (pressed)="emergencyStop.emit()" />
          </div>
        }
        <div class="dialog__header">
          <h2 class="dialog__title" id="stop-investigation-title">Stop this investigation?</h2>
          @if (busy()) {
            <p class="dialog__lead" role="status">Disconnecting… this takes up to 2 seconds.</p>
          } @else {
            <p class="dialog__lead">
              @if (device(); as deviceName) {
                I’ll send nothing more, disconnect from <bdi>{{ deviceName }}</bdi>, and give you a
                verdict from what’s known so far.
              } @else {
                I’ll give you a verdict from what’s known so far.
              }
              Everything is kept.
            </p>
          }
        </div>
        <div class="dialog__footer">
          <button
            #keepGoing
            class="btn btn--lg"
            type="button"
            [disabled]="busy()"
            (click)="close()"
          >
            Keep going
          </button>
          <button
            class="btn btn--danger btn--lg"
            type="button"
            [disabled]="busy()"
            (click)="confirmed.emit()"
          >
            Stop and get a verdict
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class StopInvestigationDialog {
  readonly device = input<string | null>(null);
  readonly busy = input(false);
  readonly closed = output<void>();
  readonly confirmed = output<void>();
  readonly emergencyStop = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly keepGoing = viewChild.required<ElementRef<HTMLButtonElement>>('keepGoing');

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.keepGoing().nativeElement.focus();
    });
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    this.dialog().nativeElement.close();
    this.closed.emit();
  }
}
