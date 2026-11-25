import type { SimulationRecorder } from './simulation-recorder';

// What a spec reads from the fake model: every prompt, so it can assert their size (NFR-020) or
// that none was made (FR-005).
export class FakeModel {
  constructor(private readonly recorder: SimulationRecorder) {}

  prompts(): string[] {
    return this.recorder.prompts();
  }
}
