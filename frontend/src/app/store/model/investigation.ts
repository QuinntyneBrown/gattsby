import type { OperatingMode } from './operating-mode';
import type { ModeChange } from './mode-change';
import type { Stage } from './stage';
import type { Verdict } from './verdict';

export type InvestigationStatus = 'running' | 'paused' | 'concluded' | 'stopped';

// One attempt to identify one device (FR-007): the record's header row in `investigations`.
export interface Investigation {
  readonly id: string;
  readonly startedAt: number;
  readonly mode: OperatingMode;
  readonly modeChanges?: readonly ModeChange[];
  readonly appVersion: string;
  readonly kbVersion: string;
  readonly recordFormat: number;
  readonly stage: Stage;
  readonly status: InvestigationStatus;
  readonly lastCommittedStep: number;
  readonly deviceName: string | null;
  readonly location?: string;
  readonly note?: string;
  readonly endedAt: number | null;
  readonly interruptedAt: number | null;
  readonly verdict: Verdict | null;
  readonly profileId: string | null;
  readonly modelConsultations: number;
}

export type InvestigationPatch = Partial<
  Pick<
    Investigation,
    | 'stage'
    | 'mode'
    | 'modeChanges'
    | 'status'
    | 'lastCommittedStep'
    | 'deviceName'
    | 'endedAt'
    | 'interruptedAt'
    | 'verdict'
    | 'profileId'
    | 'modelConsultations'
  >
>;

export interface NewInvestigation {
  readonly mode: OperatingMode;
  readonly appVersion: string;
  readonly kbVersion: string;
}
