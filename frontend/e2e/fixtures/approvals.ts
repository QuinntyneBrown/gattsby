import type { SimulationRecorder } from './simulation-recorder';

// The approvals the person gave, recorded by the page objects (ApprovalDialog) when they tap
// "Send". The unapproved-write guard matches every write against them.
export class Approvals {
  constructor(private readonly recorder: SimulationRecorder) {}

  record(characteristic: string, bytes: readonly number[]): void {
    this.recorder.approve(characteristic, bytes);
  }
}
