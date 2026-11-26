export interface ImportOutcome {
  readonly kind: 'profile' | 'record';
  readonly id: string;
  readonly displayName: string;
  readonly alreadyStored: boolean;
}
