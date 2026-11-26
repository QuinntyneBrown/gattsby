import type { ApprovalDecision } from './approval-decision';
import type { OperatingMode } from './operating-mode';
import type { Stage } from './stage';

export interface EmergencyStopEvent {
  readonly tappedAt: number;
  readonly stage: Stage;
  readonly mode: OperatingMode;
  readonly outcome: 'acknowledged' | 'notAcknowledged' | 'noKnownStop';
  readonly reported: 'stopped' | 'stillMoving' | null;
  readonly approvals: readonly ApprovalDecision[];
  readonly evidence: readonly string[];
}
