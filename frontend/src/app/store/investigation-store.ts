import type { Investigation, NewInvestigation } from './model/investigation';
import type { InvestigationNote } from './model/investigation-note';
import type { InvestigationRecord } from './model/investigation-record';
import type { RawLogEntry } from './model/raw-log-entry';
import type { StepCommit } from './model/step-commit';
import type { VerdictCommit } from './model/verdict-commit';

// The contract of the investigation store, the only code that touches IndexedDB
// (save-as-the-investigation-runs design). Every refusal is a `StoreError`.
export abstract class InvestigationStore {
  /** Writes a new investigation and resolves once the transaction has committed (FR-007). */
  abstract create(init: NewInvestigation): Promise<Investigation>;
  /** Writes one step with everything it produced in one transaction (FR-060). */
  abstract commitStep(commit: StepCommit): Promise<void>;
  /** Writes raw log entries of a step still running; they stay provisional until it commits. */
  abstract flushRawLog(entries: readonly RawLogEntry[]): Promise<void>;
  /** Writes the verdict and the final step together; refuses a second verdict. */
  abstract commitVerdict(commit: VerdictCommit): Promise<void>;
  /** Drops what an interrupted step left and marks the investigation paused (NFR-007). */
  abstract recover(id: string): Promise<Investigation>;
  abstract get(id: string): Promise<InvestigationRecord>;
  abstract getInvestigation(id: string): Promise<Investigation>;
  abstract saveNote(id: string, note: InvestigationNote): Promise<InvestigationNote>;
  abstract list(): Promise<Investigation[]>;
  abstract rawLog(id: string): Promise<RawLogEntry[]>;
  abstract rawLogPages(id: string): AsyncIterable<RawLogEntry[]>;
  abstract recordings(id: string): Promise<import('./model/recording').Recording[]>;
  abstract photos(id: string): Promise<import('./model/investigation-photo').InvestigationPhoto[]>;
  abstract photoCount(id: string): Promise<number>;
  abstract rawEvidence(id: string, ids: readonly string[]): Promise<RawLogEntry[]>;
  abstract getProfile(id: string): Promise<import('./model/device-profile').DeviceProfile>;
  /** Returns the packets linked to one recording, or null if the recording does not exist. */
  abstract recordedPackets(
    investigationId: string,
    recordingId: string,
  ): Promise<RawLogEntry[] | null>;
  /** Whether storage opens, and how much of the quota is used; prompts for nothing. */
  abstract usage(): Promise<{
    open: boolean;
    persisted: boolean;
    quotaBytes: number;
    usageBytes: number;
  }>;
  /** Asks the browser once for persistent storage (NFR-016); a refusal is not an error. */
  abstract requestPersistence(): Promise<boolean>;
}
