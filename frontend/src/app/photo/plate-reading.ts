import type { PlateDetails } from './plate-details';

export interface PlateReading extends PlateDetails {
  readonly confidence: number;
}
