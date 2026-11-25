export interface ScoreContribution {
  readonly rule: string;
  readonly weight: number;
  readonly observationIds: readonly string[];
}

// One version of the protocol guess (FR-053; track-the-hypothesis design).
export interface Hypothesis {
  readonly investigationId: string;
  readonly version: number;
  /** Evidence ID, `h-` and the version. */
  readonly id: string;
  readonly stepN: number;
  readonly source: 'model' | 'rules' | 'checklist';
  readonly previousVersion: number | null;
  readonly protocol: string;
  readonly label: string;
  readonly deviceType: string | null;
  readonly maker: string | null;
  readonly model: string | null;
  readonly confidence: number;
  readonly proposedConfidence?: number;
  readonly evidence: readonly string[];
  readonly contributions: readonly ScoreContribution[];
  readonly createdAt: number;
}
