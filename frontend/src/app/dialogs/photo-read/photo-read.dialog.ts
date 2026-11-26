import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { PlateDetails } from '../../photo/plate-details';
import type { PlateReading } from '../../photo/plate-reading';
import type { PhotoStage } from '../../photo/photo-stage';
import { EmergencyStopButtonComponent } from '../../ui/emergency-stop-button/emergency-stop-button.component';

@Component({
  selector: 'g-photo-read-dialog',
  imports: [EmergencyStopButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../native-dialog.css',
  styles: `
    .plate-preview {
      display: block;
      width: 100%;
      max-height: 220px;
      object-fit: contain;
      border-radius: var(--radius-md);
      background: var(--color-bg-surface-sunken);
    }
    .plate-summary {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
    }
    .plate-summary .plate-preview {
      width: 96px;
      height: 96px;
      flex: 0 0 96px;
    }
  `,
  template: `
    <dialog #dialog class="dialog" aria-labelledby="plate-title" (cancel)="close($event)">
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
          <div>
            <h2 class="dialog__title" id="plate-title">{{ title() }}</h2>
            @if (stage() === 'manual') {
              <p class="dialog__lead">Enter what you can read on the model plate or console.</p>
            }
          </div>
        </div>
        @if (stage() === 'checking' || stage() === 'reading') {
          <div class="dialog__body stack">
            @if (preview(); as imageUrl) {
              <img class="plate-preview" [src]="imageUrl" alt="Photo of the model plate" />
            }
            <p role="status">
              {{
                stage() === 'checking'
                  ? 'Checking image input…'
                  : 'Reading the plate on this device…'
              }}
            </p>
          </div>
          <div class="dialog__footer">
            <button class="btn btn--lg" type="button" (click)="typeRequested.emit()">
              Type instead
            </button>
          </div>
        } @else if (stage() === 'capture') {
          <div class="dialog__body stack">
            <p>Fill the frame with the maker and model. The photo stays on this device.</p>
            @if (error(); as message) {
              <p role="alert">{{ message }}</p>
            }
            <input #picker type="file" hidden accept="image/*" (change)="chooseFile(picker)" />
          </div>
          <div class="dialog__footer">
            <button class="btn btn--lg" type="button" (click)="typeRequested.emit()">
              Type instead
            </button>
            <button class="btn btn--lg" type="button" (click)="picker.click()">
              Choose a photo
            </button>
            @if (cameraAvailable()) {
              <button
                class="btn btn--primary btn--lg"
                type="button"
                (click)="cameraRequested.emit()"
              >
                Open camera
              </button>
            }
          </div>
        } @else if (stage() === 'camera') {
          <div class="dialog__body stack">
            <video
              #cameraVideo
              class="plate-preview"
              autoplay
              muted
              playsinline
              aria-label="Camera preview"
              (loadeddata)="frameReady.set(true)"
            ></video>
            <p>Hold still and keep the text in the frame.</p>
          </div>
          <div class="dialog__footer">
            <button class="btn btn--lg" type="button" (click)="typeRequested.emit()">
              Type instead
            </button>
            <button
              class="btn btn--primary btn--lg"
              type="button"
              [disabled]="!frameReady()"
              (click)="captured.emit(cameraVideo)"
            >
              Take photo
            </button>
          </div>
        } @else {
          <form novalidate (submit)="submit($event, maker.value, model, serial.value)">
            <div class="dialog__body stack">
              @if (reading(); as suggestion) {
                <div class="plate-summary">
                  @if (preview(); as imageUrl) {
                    <img class="plate-preview" [src]="imageUrl" alt="Photo of the model plate" />
                  }
                  <p class="fine-print">
                    Model confidence {{ percent(suggestion.confidence) }}%. Check the fields against
                    the plate before saving.
                  </p>
                </div>
              }
              <label class="field">
                <span class="field__label">Maker</span>
                <input #maker class="input" maxlength="120" [value]="reading()?.maker ?? ''" />
              </label>
              <label class="field">
                <span class="field__label">Model</span>
                <input
                  #model
                  class="input"
                  maxlength="120"
                  required
                  [value]="reading()?.model ?? ''"
                  [attr.aria-invalid]="invalid() || null"
                />
              </label>
              <label class="field">
                <span class="field__label">Serial number (optional)</span>
                <input #serial class="input" maxlength="120" [value]="reading()?.serial ?? ''" />
              </label>
              @if (invalid()) {
                <p role="alert">Enter the model, or tap Skip.</p>
              }
              @if (error(); as message) {
                <p role="alert">{{ message }}</p>
              }
            </div>
            <div class="dialog__footer">
              @if (stage() === 'review' || canChoosePhoto()) {
                <button
                  class="btn btn--lg"
                  type="button"
                  [disabled]="saving()"
                  (click)="retakeRequested.emit()"
                >
                  Retake
                </button>
              } @else {
                <button class="btn btn--lg" type="button" [disabled]="saving()" (click)="close()">
                  Skip
                </button>
              }
              <button class="btn btn--primary btn--lg" type="submit" [disabled]="saving()">
                Use this
              </button>
            </div>
          </form>
        }
      </div>
    </dialog>
  `,
})
export class PhotoReadDialog {
  readonly connected = input(false);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly stage = input<PhotoStage>('manual');
  readonly cameraAvailable = input(false);
  readonly canChoosePhoto = input(false);
  readonly stream = input<MediaStream | null>(null);
  readonly preview = input<string | null>(null);
  readonly reading = input<PlateReading | null>(null);
  readonly closed = output<void>();
  readonly confirmed = output<PlateDetails>();
  readonly emergencyStop = output<void>();
  readonly cameraRequested = output<void>();
  readonly captured = output<HTMLVideoElement>();
  readonly fileChosen = output<File>();
  readonly typeRequested = output<void>();
  readonly retakeRequested = output<void>();
  protected readonly invalid = signal(false);
  protected readonly frameReady = signal(false);
  protected readonly title = computed(
    () =>
      ({
        checking: 'Read the model plate',
        capture: 'Read the model plate',
        camera: 'Frame the model plate',
        reading: 'Reading the photo',
        review: 'Check what I read',
        manual: 'Type the model instead',
      })[this.stage()],
  );
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('cameraVideo');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
    effect(() => {
      const video = this.video()?.nativeElement;
      const stream = this.stream();
      this.frameReady.set(false);
      if (video) video.srcObject = stream;
    });
    effect(() => {
      this.stage();
      this.invalid.set(false);
    });
  }

  protected chooseFile(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) this.fileChosen.emit(file);
  }

  protected percent(value: number): number {
    return Math.round(value * 100);
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    if (!this.saving()) this.closed.emit();
  }

  protected stop(): void {
    this.closed.emit();
    this.emergencyStop.emit();
  }

  protected submit(event: Event, maker: string, model: HTMLInputElement, serial: string): void {
    event.preventDefault();
    const value = model.value.trim();
    this.invalid.set(!value);
    if (!value) {
      model.focus();
      return;
    }
    this.confirmed.emit({ maker: maker.trim(), model: value, serial: serial.trim() });
  }
}
