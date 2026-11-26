export interface ReachabilityAssessment {
  readonly reachable: 'yes' | 'no' | 'unknown';
  readonly likelyCauses: readonly string[];
  readonly ruledOut: readonly string[];
}
