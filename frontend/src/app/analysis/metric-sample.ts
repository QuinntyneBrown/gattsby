export interface MetricSample {
  readonly value: number;
  readonly t: number;
  readonly rawLogId: string;
}
