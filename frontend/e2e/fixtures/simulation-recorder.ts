import type { SimulationEvent } from '../../src/simulation/simulation-event';

export type ViolationKind =
  | 'unexpected-bluetooth'
  | 'unapproved-write'
  | 'unexpected-model'
  | 'request-off-localhost'
  | 'page-error'
  | 'dialog'
  | 'csp-violation'
  | 'geolocation';

export interface Violation {
  readonly kind: ViolationKind;
  readonly detail: string;
}

type WriteEvent = Extract<SimulationEvent, { kind: 'write' }>;

interface Approval {
  readonly seq: number;
  readonly characteristic: string;
  readonly bytes: readonly number[];
}

// Everything the fakes and the page did during one spec, in order, on the Node side, so the
// records survive a reload. The guards read it at teardown.
export class SimulationRecorder {
  private seq = 0;
  readonly events: { readonly seq: number; readonly event: SimulationEvent }[] = [];
  private readonly approvals: Approval[] = [];
  private readonly recorded: Violation[] = [];

  add(event: SimulationEvent): void {
    this.events.push({ seq: this.seq++, event });
    switch (event.kind) {
      case 'unexpected-bluetooth':
      case 'unexpected-model':
      case 'geolocation':
      case 'csp-violation':
        this.violation(event.kind, event.detail);
        break;
    }
  }

  violation(kind: ViolationKind, detail: string): void {
    this.recorded.push({ kind, detail });
  }

  /** Recorded by the page objects when the person approves one write (ApprovalDialog). */
  approve(characteristic: string, bytes: readonly number[]): void {
    this.approvals.push({ seq: this.seq++, characteristic, bytes });
  }

  writes(): WriteEvent[] {
    return this.events.flatMap(({ event }) => (event.kind === 'write' ? [event] : []));
  }

  prompts(): string[] {
    return this.events.flatMap(({ event }) => (event.kind === 'model-prompt' ? [event.input] : []));
  }

  /** Every violation so far: the recorded ones, then each write with no earlier approval. */
  violations(): Violation[] {
    const unused = [...this.approvals];
    const unapproved: Violation[] = [];
    for (const { seq, event } of this.events) {
      if (event.kind !== 'write') continue;
      const index = unused.findIndex(
        (approval) =>
          approval.seq < seq &&
          approval.characteristic === event.characteristic &&
          sameBytes(approval.bytes, event.bytes),
      );
      if (index === -1) {
        unapproved.push({
          kind: 'unapproved-write',
          detail: `${toHex(event.bytes)} to ${event.characteristic} on ${event.device}`,
        });
      } else {
        unused.splice(index, 1);
      }
    }
    return [...this.recorded, ...unapproved];
  }
}

function sameBytes(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

function toHex(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}
