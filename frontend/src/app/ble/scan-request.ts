// What `requestDevice` is called with, and the UUIDs left out for Chrome's blocklist
// (scan-for-the-device design).
export interface ScanRequest {
  readonly options: RequestDeviceOptions;
  readonly excludedAsBlocklisted: readonly string[];
  readonly mode: 'filtered' | 'acceptAll';
}
