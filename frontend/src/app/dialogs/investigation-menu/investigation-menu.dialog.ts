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
  selector: 'g-investigation-menu-dialog',
  imports: [EmergencyStopButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../native-dialog.css',
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="investigation-options-title"
      (cancel)="close($event)"
    >
      <div class="dialog__panel">
        <div class="dialog__grabber" aria-hidden="true"></div>
        <div class="dialog__toolbar">
          @if (connected()) {
            <g-emergency-stop-button (pressed)="stop()" />
          }
          <button
            class="btn btn--ghost btn--icon"
            type="button"
            aria-label="Close"
            (click)="close()"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="dialog__header">
          <h2 class="dialog__title" id="investigation-options-title">Investigation options</h2>
        </div>
        <div class="dialog__body">
          <ul class="sheet-menu">
            <li>
              <button #note class="sheet-menu__item" type="button" (click)="addNote()">
                <span class="sheet-menu__title">Add a note or the location</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </dialog>
  `,
})
export class InvestigationMenuDialog {
  readonly connected = input(false);
  readonly closed = output<void>();
  readonly noteRequested = output<void>();
  readonly emergencyStop = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly note = viewChild.required<ElementRef<HTMLButtonElement>>('note');

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.note().nativeElement.focus();
    });
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    this.dialog().nativeElement.close();
    this.closed.emit();
  }

  protected addNote(): void {
    this.dialog().nativeElement.close();
    this.noteRequested.emit();
  }

  protected stop(): void {
    this.close();
    this.emergencyStop.emit();
  }
}
