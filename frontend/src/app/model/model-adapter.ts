import type { PlateReading } from '../photo/plate-reading';
import type { ModelAvailability } from './model-availability';
import type { ModelSession } from './model-session';

export interface ModelAdapter {
  availability(): Promise<ModelAvailability>;
  downloadInfo(): Promise<number | null>;
  download(onProgress: (percent: number) => void, signal: AbortSignal): Promise<void>;
  open(signal: AbortSignal): Promise<ModelSession | null>;
  readImage?(photo: Blob, signal: AbortSignal): Promise<PlateReading | null>;
}
