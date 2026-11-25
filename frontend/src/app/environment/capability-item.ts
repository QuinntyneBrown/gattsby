export interface CapabilityItem {
  readonly label: string;
  readonly detail: string;
  readonly status: 'ok' | 'warn' | 'na' | 'pending';
}
