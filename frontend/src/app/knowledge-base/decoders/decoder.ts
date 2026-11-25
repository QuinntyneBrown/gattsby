// Turns the bytes of one characteristic into a value a person can read. Pure and deterministic:
// the model never decodes bytes (AGENTS.md "Architecture").
export interface DecodedValue {
  /** What the bytes mean, as text: "90 %", "Chest", "Speed 0.8–16.0 km/h by 0.1". */
  readonly text: string;
  /** The value in a structured form, for the device profile. */
  readonly value: unknown;
}

export interface Decoder {
  readonly id: string;
  /** Throws `DecodeError` when the bytes do not fit. */
  decode(bytes: Uint8Array): DecodedValue;
}

export class DecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecodeError';
  }
}
