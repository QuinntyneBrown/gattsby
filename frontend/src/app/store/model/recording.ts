/** A timed capture. Packet rows link to this recording by ID within the investigation. */
export interface Recording {
  readonly id: string;
  readonly investigationId: string;
  readonly stepN: number;
  readonly label: string;
  readonly level?: number;
  readonly characteristics: readonly string[];
  readonly startedAt: number;
  readonly seconds: number;
  readonly interrupted: boolean;
  readonly valueCount: number;
}
