import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { formatStorage } from '../../shared/format-storage';
import { ImportError } from '../../store/import-error';
import { ImportService } from '../../store/import-service';
import type { ImportOutcome } from '../../store/model/import-outcome';

@Component({
  selector: 'g-import-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../native-dialog.css',
  styles: `
    .dialog__body {
      display: grid;
      gap: var(--space-3);
      overflow-wrap: anywhere;
    }
  `,
  template: `
    <dialog #dialog class="dialog" aria-labelledby="import-title" (cancel)="cancel($event)">
      <div class="dialog__panel">
        <div class="dialog__grabber" aria-hidden="true"></div>
        <div class="dialog__header">
          <h2 class="dialog__title" id="import-title">Import</h2>
        </div>
        <div class="dialog__body">
          <input
            #picker
            hidden
            aria-label="Choose a file"
            type="file"
            accept=".json,application/json"
            (change)="choose(picker)"
          />
          @if (checking(); as file) {
            <div role="status">
              <p>
                <bdi>{{ file.name }}</bdi> · {{ size(file.size) }}
              </p>
              <p>Checking the file format…</p>
            </div>
          } @else if (failure(); as error) {
            <div class="alert alert--danger" role="alert">
              <div class="alert__body">
                <p class="alert__title">{{ error.message }}</p>
                @if (error.detail) {
                  <p>
                    <bdi>{{ error.detail }}</bdi>
                  </p>
                }
                <p>Nothing was imported.</p>
              </div>
            </div>
          } @else if (outcome(); as result) {
            <div role="status">
              @if (result.alreadyStored) {
                <p>
                  <bdi>{{ result.displayName }}</bdi> is already on this device.
                </p>
              } @else {
                <p>
                  Imported <bdi>{{ result.displayName }}</bdi>.
                </p>
                <p>
                  {{
                    result.kind === 'profile'
                      ? 'It’s in Saved devices.'
                      : 'It’s in Past investigations.'
                  }}
                </p>
              }
            </div>
          } @else {
            <p>A device profile or investigation record exported by Gattsby (.json).</p>
          }
        </div>
        <div class="dialog__footer">
          <button class="btn btn--lg" type="button" (click)="cancel()">
            {{ outcome() ? 'Done' : 'Cancel' }}
          </button>
          @if (outcome(); as result) {
            <button class="btn btn--primary btn--lg" type="button" (click)="open(result)">
              {{ result.kind === 'profile' ? 'Open the profile' : 'Open the investigation' }}
            </button>
          } @else if (!checking()) {
            <button class="btn btn--primary btn--lg" type="button" (click)="picker.click()">
              Choose a file
            </button>
          }
        </div>
      </div>
    </dialog>
  `,
})
export class ImportDialog {
  readonly closed = output<void>();
  readonly imported = output<void>();
  private readonly service = inject(ImportService);
  private readonly router = inject(Router);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private controller: AbortController | null = null;
  protected readonly checking = signal<File | null>(null);
  protected readonly failure = signal<ImportError | null>(null);
  protected readonly outcome = signal<ImportOutcome | null>(null);
  protected readonly size = formatStorage;

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
    inject(DestroyRef).onDestroy(() => this.controller?.abort());
  }

  protected async choose(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.checking()) return;
    this.failure.set(null);
    this.checking.set(file);
    const controller = new AbortController();
    this.controller = controller;
    try {
      const outcome = await this.service.import(file, controller.signal);
      if (controller.signal.aborted) return;
      this.outcome.set(outcome);
      this.imported.emit();
    } catch (error) {
      if (!controller.signal.aborted) {
        this.failure.set(
          error instanceof ImportError
            ? error
            : new ImportError('STORAGE_UNAVAILABLE', 'Gattsby couldn’t import this file.'),
        );
      }
    } finally {
      this.checking.set(null);
      this.controller = null;
    }
  }

  protected async open(result: ImportOutcome): Promise<void> {
    this.cancel();
    await this.router.navigate(
      result.kind === 'profile'
        ? ['/profiles', result.id]
        : ['/investigations', result.id, result.hasVerdict ? 'verdict' : 'evidence'],
    );
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    this.controller?.abort();
    this.dialog().nativeElement.close();
    this.closed.emit();
  }
}
