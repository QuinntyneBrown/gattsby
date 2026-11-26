export interface StorageUsage {
  readonly open: boolean;
  readonly persisted: boolean;
  readonly quotaBytes: number;
  readonly usageBytes: number;
}
