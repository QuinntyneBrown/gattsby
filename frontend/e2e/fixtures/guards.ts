import type { SimulationRecorder, Violation, ViolationKind } from './simulation-recorder';

// The guards of the simulate-devices-and-model design. They record during the spec and fail it
// at teardown with what happened. A spec that proves a guard trips acknowledges the violation it
// caused, so only unexpected violations fail it.
export class Guards {
  private readonly acknowledged = new Map<ViolationKind, number>();

  constructor(private readonly recorder: SimulationRecorder) {}

  kinds(): ViolationKind[] {
    return this.recorder.violations().map((violation) => violation.kind);
  }

  acknowledge(kind: ViolationKind): void {
    this.acknowledged.set(kind, (this.acknowledged.get(kind) ?? 0) + 1);
  }

  unacknowledged(): Violation[] {
    const remaining = new Map(this.acknowledged);
    return this.recorder.violations().filter((violation) => {
      const left = remaining.get(violation.kind) ?? 0;
      if (left > 0) {
        remaining.set(violation.kind, left - 1);
        return false;
      }
      return true;
    });
  }

  verify(): void {
    const violations = this.unacknowledged();
    if (violations.length > 0) {
      throw new Error(
        `A guard failed this spec:\n${violations.map((v) => `  - ${v.kind}: ${v.detail}`).join('\n')}`,
      );
    }
  }
}
