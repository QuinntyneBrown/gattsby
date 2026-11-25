// One known profile scored against the device (TOOL-012).
export interface ProfileCandidate {
  readonly profileId: string;
  readonly label: string;
  readonly protocol: string;
  readonly serviceUuid: string;
  readonly deviceType: string;
  readonly score: number;
  readonly matched: readonly string[];
  readonly missing: readonly string[];
}
