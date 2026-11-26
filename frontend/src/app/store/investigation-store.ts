import type { Investigation, NewInvestigation } from './model/investigation';
import type { InvestigationNote } from './model/investigation-note';
import type { InvestigationRecord } from './model/investigation-record';
import type { RawLogEntry } from './model/raw-log-entry';
import type { StepCommit } from './model/step-commit';
import type { Stage } from './model/stage';
import type { ModeChange } from './model/mode-change';
import type { MissingToolListEntry } from './model/missing-tool-list-entry';
import type { StorageUsage } from './model/storage-usage';
import type { VerdictCommit } from './model/verdict-commit';

// The contract of the investigation store, the only code that touches IndexedDB
// (save-as-the-investigation-runs design). Every refusal is a `StoreError`.
export abstract class InvestigationStore {
  /** Writes a new investigation and resolves once the transaction has committed (FR-007). */
  abstract create(init: NewInvestigation): Promise<Investigation>;
  /** Writes one step with everything it produced in one transaction (FR-060). */
  abstract commitStep(commit: StepCommit): Promise<void>;
  abstract latchEmergencyStop(id: string, at: number): Promise<void>;
  /** Writes raw log entries of a step still running; they stay provisional until it commits. */
  abstract flushRawLog(entries: readonly RawLogEntry[]): Promise<void>;
  /** Removes only the raw rows of a recording whose step failed to commit. */
  abstract discardProvisionalPackets(id: string, stepN: number): Promise<void>;
  /** Writes the verdict and the final step together; refuses a second verdict. */
  abstract commitVerdict(commit: VerdictCommit): Promise<void>;
  /** Drops what an interrupted step left and marks the investigation paused (NFR-007). */
  abstract recover(id: string, stage?: Stage): Promise<Investigation>;
  abstract reactivate(id: string, modeChange?: ModeChange): Promise<Investigation>;
  abstract nextRawSequence(id: string): Promise<number>;
  abstract get(id: string): Promise<InvestigationRecord>;
  abstract getInvestigation(id: string): Promise<Investigation>;
  abstract saveNote(id: string, note: InvestigationNote): Promise<InvestigationNote>;
  abstract list(): Promise<Investigation[]>;
  abstract listProfiles(limit?: number): Promise<import('./model/device-profile').DeviceProfile[]>;
  abstract listMissingTools(): Promise<MissingToolListEntry[]>;
  abstract rawLog(id: string): Promise<RawLogEntry[]>;
  abstract rawLogCount(id: string): Promise<number>;
  abstract rawLogPages(id: string): AsyncIterable<RawLogEntry[]>;
  abstract rawLogSizeEstimate(id: string): Promise<number>;
  abstract recordings(id: string): Promise<import('./model/recording').Recording[]>;
  abstract photos(id: string): Promise<import('./model/investigation-photo').InvestigationPhoto[]>;
  abstract photoCount(id: string): Promise<number>;
  abstract rawEvidence(id: string, ids: readonly string[]): Promise<RawLogEntry[]>;
  abstract getProfile(id: string): Promise<import('./model/device-profile').DeviceProfile>;
  /** Returns the packets linked to one recording, or null if the recording does not exist. */
  abstract recordedPackets(
    investigationId: string,
    recordingId: string,
    limitPerCharacteristic?: number,
  ): Promise<RawLogEntry[] | null>;
  /** Whether storage opens, and how much of the quota is used; prompts for nothing. */
  abstract usage(): Promise<StorageUsage>;
  /** Asks the browser once for persistent storage (NFR-016); a refusal is not an error. */
  abstract requestPersistence(): Promise<boolean>;
  abstract useAgentWhenAvailable(): Promise<boolean>;
  abstract setUseAgentWhenAvailable(enabled: boolean): Promise<void>;
  abstract recordCapabilityDiagnostics(rows: readonly CapabilityDiagnostic[]): Promise<void>;
}
import type { CapabilityDiagnostic } from '../environment/capability-diagnostic';
