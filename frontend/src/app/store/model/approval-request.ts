import type { ControlEffect } from './control-effect';

export interface ApprovalRequest {
  readonly tool: string;
  readonly title: string;
  readonly detail: string;
  readonly risk: string;
  readonly isMotion: boolean;
  readonly sequence: string;
  readonly deviceId: string;
  readonly connectedAt: number;
  readonly service: string;
  readonly characteristic: string;
  readonly bytes: readonly number[];
  readonly effect?: ControlEffect;
}
