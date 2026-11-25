export interface CapabilityDiagnostic {
  readonly capability: 'bluetooth' | 'model' | 'storage' | 'camera';
  readonly code: string;
  readonly tool: 'check_capabilities';
  readonly stage: 'prepare';
  readonly at: number;
}
