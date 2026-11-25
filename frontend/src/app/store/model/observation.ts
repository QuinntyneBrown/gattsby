export type ObservationTag = 'confirmed' | 'likely' | 'guess';

// A fact a tool established (AGENTS.md "Words"). `kind`, `subject` and `value` decide whether it
// is new (end-the-loop design, counting rule 2).
export interface Observation {
  readonly investigationId: string;
  /** Evidence ID, `o-` and a number. */
  readonly id: string;
  readonly stepN: number;
  readonly kind: string;
  readonly subject: string;
  readonly value: string;
  readonly text: string;
  readonly tag: ObservationTag;
  readonly evidence: readonly string[];
}

export type NewObservation = Omit<Observation, 'investigationId' | 'id' | 'stepN'>;
