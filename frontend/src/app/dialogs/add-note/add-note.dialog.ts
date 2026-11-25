import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { InvestigationNote } from '../../store/model/investigation-note';
import { EmergencyStopButtonComponent } from '../../ui/emergency-stop-button/emergency-stop-button.component';

@Component({
  selector: 'g-add-note-dialog',
  imports: [EmergencyStopButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../native-dialog.css',
  templateUrl: './add-note.dialog.html',
})
export class AddNoteDialog {
  readonly initial = input.required<InvestigationNote>();
  readonly connected = input(false);
  readonly busy = input(false);
  readonly error = input<{ title: string; message: string } | null>(null);
  readonly closed = output<void>();
  readonly saveRequested = output<InvestigationNote>();
  readonly emergencyStop = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly location = viewChild.required<ElementRef<HTMLInputElement>>('location');
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.location().nativeElement.focus();
    });
  }

  focusError(): void {
    this.errorSummary()?.nativeElement.focus();
  }

  dismiss(): void {
    this.dialog().nativeElement.close();
    this.closed.emit();
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    if (!this.busy()) this.dismiss();
  }

  protected save(event: Event, location: string, note: string): void {
    event.preventDefault();
    if (!this.busy()) this.saveRequested.emit({ location, note });
  }

  protected stop(): void {
    this.dismiss();
    this.emergencyStop.emit();
  }
}
