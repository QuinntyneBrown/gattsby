import type { BleLayer } from '../ble/ble-layer';
import type { CapabilityDetector } from '../environment/capability-detector';
import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import type { DecisionState } from '../agent/decision-state';
import type { ControlTelemetry } from '../agent/control-telemetry';
import type { ConfirmationCheck } from '../agent/confirmation-check';
import type { PromptChannel } from '../agent/prompt-channel';
import type { Clock } from '../shared/clock';
import type { NewObservation } from '../store/model/observation';
import type { ApprovalDecision } from '../store/model/approval-decision';
import type { Stage } from '../store/model/stage';
import type { Recording } from '../store/model/recording';
import type { RawLogEntry } from '../store/model/raw-log-entry';
import type { MissingToolRequest } from '../store/model/missing-tool-request';
import type { MissingToolSource } from '../store/model/missing-tool-source';
import type { VerdictFacts } from '../outcome/verdict-builder';
import type { HypothesisProposer } from './meta/update-hypothesis.tool';
import type { NotificationRecorder } from './listening/notification-recorder';
import type { ControlPointExchange } from './control/control-point-exchange';

export type NewMissingToolRequest = Pick<
  MissingToolRequest,
  'capabilityKey' | 'title' | 'reason' | 'evidence'
> & { readonly source?: MissingToolSource };

// What a tool may use while it runs (return-a-result-envelope design). The context hands out
// evidence IDs and collects them, so the envelope carries every ID the call created.
export interface ToolContext {
  readonly investigationId: string;
  readonly stage: Stage;
  readonly stepN: number;
  readonly state: DecisionState;
  readonly ble: BleLayer;
  readonly notificationRecorder: NotificationRecorder;
  readonly confirmationCheck: ConfirmationCheck;
  readonly kb: KnowledgeBaseIndex;
  readonly prompts: PromptChannel;
  readonly clock: Clock;
  readonly capabilities: CapabilityDetector;
  readonly signal: AbortSignal;
  readonly hypotheses: HypothesisProposer;
  readonly controlPoint: ControlPointExchange;
  readonly controlTelemetry: ControlTelemetry;
  connectionAttempt?(attempt: number): void;
  lockControl(): void;
  readonly approval?: ApprovalDecision;
  /** What the verdict is checked against, as of now. */
  verdictFacts(): VerdictFacts;
  /** Records an observation and returns its `o-` evidence ID. */
  observe(observation: NewObservation): string;
  /** Commits a recording with its tool step. Returns the recording's evidence ID. */
  saveRecording(recording: Omit<Recording, 'investigationId' | 'stepN'>): string;
  recordings(): Promise<readonly Recording[]>;
  recordedPackets(
    recordingId: string,
    limitPerCharacteristic?: number,
  ): Promise<RawLogEntry[] | null>;
  /** Records a missing-tool request and returns its `m-` evidence ID. */
  raiseMissingTool(request: NewMissingToolRequest): string;
}
