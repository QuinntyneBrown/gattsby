// A sanitized photo stored locally for one investigation. Serialize only on explicit opt-in.
export interface InvestigationPhoto {
  readonly investigationId: string;
  readonly id: string;
  readonly mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly takenAt: number;
  readonly dataBase64: string;
}
