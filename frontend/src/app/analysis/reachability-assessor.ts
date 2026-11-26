import type { ReachabilityAssessment } from './reachability-assessment';
import {
  REACHABILITY_CHECKS,
  type ReachabilityCheck,
  type ReachabilityCheckResult,
} from './reachability-checks';

export function assessReachability(input: {
  readonly chosen: boolean;
  readonly connected: boolean;
  readonly refusedConnections: number;
  readonly unrecognisedScans: number;
  readonly checks: Readonly<Partial<Record<ReachabilityCheck, ReachabilityCheckResult>>>;
}): ReachabilityAssessment {
  const ruledOut = REACHABILITY_CHECKS.filter(({ key }) => input.checks[key] === 'confirmed').map(
    ({ cause }) => cause,
  );
  if (input.connected) return { reachable: 'yes', likelyCauses: [], ruledOut };
  if (input.refusedConnections >= 2 || input.checks.connections === 'blocked') {
    return {
      reachable: 'no',
      likelyCauses: ['held by another central'],
      ruledOut: ruledOut.filter((cause) => cause !== 'held by another central'),
    };
  }
  if (input.chosen) return { reachable: 'yes', likelyCauses: [], ruledOut };
  if (input.unrecognisedScans >= 3 && ruledOut.length === REACHABILITY_CHECKS.length) {
    return {
      reachable: 'no',
      likelyCauses: ['Bluetooth Classic', 'ANT+', 'Wi-Fi', 'USB'],
      ruledOut,
    };
  }
  return {
    reachable: 'unknown',
    likelyCauses: REACHABILITY_CHECKS.map(({ cause }) => cause).filter(
      (cause) => !ruledOut.includes(cause),
    ),
    ruledOut,
  };
}
