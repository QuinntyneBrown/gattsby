import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ModelAdapterLoader } from '../model/model-adapter-loader';
import { Clock } from '../shared/clock';
import type { OperatingMode } from '../store/model/operating-mode';
import type { InvestigationPhoto } from '../store/model/investigation-photo';
import type { PhotoStage } from './photo-stage';
import type { PlateReading } from './plate-reading';

const READ_LIMIT_MS = 10_000;

@Injectable()
export class PlatePhoto {
  private readonly adapters = inject(ModelAdapterLoader);
  private readonly clock = inject(Clock);
  private operation = new AbortController();
  private image: Blob | null = null;
  private stopStream?: () => void;
  readonly stage = signal<PhotoStage>('manual');
  readonly cameraAvailable = signal(false);
  readonly imageAvailable = signal(false);
  readonly stream = signal<MediaStream | null>(null);
  readonly preview = signal<string | null>(null);
  readonly reading = signal<PlateReading | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
  }

  async open(mode: OperatingMode): Promise<void> {
    this.close();
    this.imageAvailable.set(false);
    this.stage.set(mode === 'agent' ? 'checking' : 'manual');
    if (mode !== 'agent') return;
    const signal = this.operation.signal;
    try {
      const [{ cameraAvailable }, adapter] = await Promise.all([
        import('./media-devices-camera-adapter'),
        this.adapters.load(),
      ]);
      const capability = await adapter?.availability();
      if (signal.aborted) return;
      this.imageAvailable.set(!!adapter?.readImage && !!capability?.imageInput);
      this.cameraAvailable.set(cameraAvailable());
      this.stage.set(this.imageAvailable() ? 'capture' : 'manual');
    } catch {
      if (!signal.aborted) this.stage.set('manual');
    }
  }

  async camera(): Promise<void> {
    if (!this.imageAvailable() || this.stage() !== 'capture') return;
    this.clear();
    const signal = this.operation.signal;
    try {
      const { openCamera, stopCamera } = await import('./media-devices-camera-adapter');
      const stream = await openCamera(signal);
      if (signal.aborted) {
        stopCamera(stream);
        return;
      }
      this.stopStream = () => stopCamera(stream);
      this.stream.set(stream);
      this.stage.set('camera');
    } catch {
      if (!signal.aborted)
        this.error.set('Couldn’t open the camera. Choose a local photo or type the model.');
    }
  }

  async capture(video: HTMLVideoElement): Promise<void> {
    await this.read(async () => {
      const { encodePhoto } = await import('./photo-sanitizer');
      return await encodePhoto(video, video.videoWidth, video.videoHeight);
    });
  }

  async choose(file: File): Promise<void> {
    await this.read(async () => {
      const { sanitizePhoto } = await import('./photo-sanitizer');
      return await sanitizePhoto(file);
    });
  }

  retake(): void {
    this.clear();
    this.stage.set(this.imageAvailable() ? 'capture' : 'manual');
  }

  type(): void {
    this.clear();
    this.stage.set('manual');
  }

  close(): void {
    this.clear();
    this.stage.set('manual');
  }

  async attachment(investigationId: string): Promise<InvestigationPhoto | null> {
    if (!this.image || this.stage() !== 'review') return null;
    const image = this.image;
    const signal = this.operation.signal;
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(image);
    });
    signal.throwIfAborted();
    return {
      investigationId,
      id: `photo-${crypto.randomUUID()}`,
      takenAt: this.clock.now(),
      mediaType: 'image/jpeg',
      dataBase64,
    };
  }

  private async read(encode: () => Promise<Blob>): Promise<void> {
    if (!this.imageAvailable() || (this.stage() !== 'capture' && this.stage() !== 'camera')) return;
    const signal = this.operation.signal;
    this.error.set(null);
    this.stage.set('reading');
    let cancel: (() => void) | undefined;
    try {
      const image = await encode();
      signal.throwIfAborted();
      this.releaseCamera();
      this.image = image;
      this.preview.set(URL.createObjectURL(image));
      const adapter = await this.adapters.load();
      const timeout = new AbortController();
      const elapsed = new Promise<null>((resolve) => {
        cancel = this.clock.setTimeout(() => {
          resolve(null);
          timeout.abort();
        }, READ_LIMIT_MS);
      });
      const reading = await Promise.race([
        adapter?.readImage?.(image, AbortSignal.any([signal, timeout.signal])) ?? null,
        elapsed,
      ]);
      signal.throwIfAborted();
      if (!reading?.model) throw new Error('The plate is unreadable.');
      this.reading.set(reading);
      this.stage.set('review');
    } catch {
      if (!signal.aborted) {
        this.type();
        this.error.set('Couldn’t read the photo. Type the model or choose another photo.');
      }
    } finally {
      cancel?.();
    }
  }

  private releaseCamera(): void {
    this.stopStream?.();
    this.stopStream = undefined;
    this.stream.set(null);
  }

  private clear(): void {
    this.operation.abort();
    this.operation = new AbortController();
    this.releaseCamera();
    const preview = this.preview();
    if (preview) URL.revokeObjectURL(preview);
    this.image = null;
    this.preview.set(null);
    this.reading.set(null);
    this.error.set(null);
  }
}
