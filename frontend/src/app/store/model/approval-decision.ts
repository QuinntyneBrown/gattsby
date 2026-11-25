import type { ApprovalRequest } from './approval-request';

export interface ApprovalDecision {
  readonly id: string;
  readonly request: ApprovalRequest;
  readonly decision: 'send' | 'decline' | 'cancel';
  readonly standClearConfirmed: boolean;
  readonly decidedAt: number;
}
