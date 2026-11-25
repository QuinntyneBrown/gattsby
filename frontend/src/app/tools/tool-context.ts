import type { BleLayer } from '../ble/ble-layer';
import type { CapabilityDetector } from '../environment/capability-detector';
import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import type { DecisionState } from '../agent/decision-state';
import type { ConfirmationCheck } from '../agent/confirmation-check';
import type { PromptChannel } from '../agent/prompt-channel';
import type { NewObservation } from '../store/model/observation';
import type { Stage } from '../store/model/stage';
import type { Recording } from '../store/model/recording';
import type { RawLogEntry } from '../store/model/raw-log-entry';
import type { MissingToolRequest } from '../store/model/missing-tool-request';
import type { VerdictFacts } from '../outcome/verdict-builder';
import type { HypothesisProposer } from './meta/update-hypothesis.tool';
import type { NotificationRecorder } from './listening/notification-recorder';

export type NewMissingToolRequest = Pick<
  MissingToolRequest,
  'capabilityKey' | 'title' | 'reason' | 'evidence'
>;

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
  readonly capabilities: CapabilityDetector;
  readonly signal: AbortSignal;
  readonly hypotheses: HypothesisProposer;
  /** What the verdict is checked against, as of now. */
  verdictFacts(): VerdictFacts;
  /** Records an observation and returns its `o-` evidence ID. */
  observe(observation: NewObservation): string;
  /** Commits a recording with its tool step. Returns the recording's evidence ID. */
  saveRecording(recording: Omit<Recording, 'investigationId' | 'stepN'>): string;
  recordedPackets(recordingId: string): Promise<RawLogEntry[] | null>;
  /** Records a missing-tool request and returns its `m-` evidence ID. */
  raiseMissingTool(request: NewMissingToolRequest): string;
}
