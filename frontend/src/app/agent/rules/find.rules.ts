import { decided, type StageRule } from '../stage-rule';
import { REACHABILITY_CHECKS } from '../../analysis/reachability-checks';
import type { DecisionState } from '../decision-state';

function pendingCheck(state: DecisionState) {
  return REACHABILITY_CHECKS.find(
    ({ key }) => !state.reachabilityChecks[key] || state.reachabilityChecks[key] === 'needs-action',
  );
}

// Find: the filtered scan first, then the open scan after a cancel (FR-011, FR-012).
export const FIND_RULES: readonly StageRule[] = [
  {
    id: 'find.scan',
    stage: 'find',
    when: ({ state }) => !state.device && state.scans.length === 0,
    then: ({ state }) =>
      decided(
        'find.scan',
        'find',
        'scan_devices',
        { machineType: state.machineType ?? null, brand: state.brand ?? null },
        {
          text: 'Tap Find the device. Chrome will list nearby fitness machines — pick yours, or close the list if you’re not sure.',
          why: 'Chrome only lets a page see a device you choose yourself.',
        },
      ),
  },
  {
    id: 'find.report-candidates',
    stage: 'find',
    when: ({ state }) => !state.device && state.candidateHelp && state.reportedCandidates === null,
    then: () => decided('find.report-candidates', 'find', 'report_candidate_names', {}),
  },
  {
    id: 'find.automatic-match',
    stage: 'find',
    when: ({ state }) =>
      !state.device &&
      state.reportedCandidates !== null &&
      state.advertisementsAvailable &&
      !state.automaticMatchAttempted,
    then: () => decided('find.automatic-match', 'find', 'power_cycle_match', { mode: 'automatic' }),
  },
  {
    id: 'find.power-cycle',
    stage: 'find',
    when: ({ state }) =>
      !state.device && state.reportedCandidates !== null && !state.powerCycleAttempted,
    then: () => decided('find.power-cycle', 'find', 'power_cycle_match', { mode: 'guided' }),
  },
  {
    id: 'find.widen',
    stage: 'find',
    when: ({ state }) =>
      !state.device &&
      state.scans.length === 1 &&
      state.scans[state.scans.length - 1]?.outcome === 'cancelled',
    then: () =>
      decided(
        'find.widen',
        'find',
        'scan_all_devices',
        {},
        {
          text: 'It may not advertise as a fitness machine. I can ask Chrome for every Bluetooth device nearby instead — names in that list can look unfamiliar.',
          why: 'Some machines only show up when the list isn’t filtered.',
        },
      ),
  },
  {
    id: 'find.check-usual-causes',
    stage: 'find',
    when: ({ state }) =>
      !state.device &&
      state.scans.length === 2 &&
      state.scans.every(({ outcome }) => outcome === 'cancelled') &&
      !!pendingCheck(state),
    then: ({ state }) => {
      const check = pendingCheck(state)!;
      if (state.reachabilityChecks[check.key] === 'needs-action' && check.remedy) {
        return decided(`find.repair.${check.key}`, 'find', 'request_action', {
          instruction: check.remedy,
          needsReady: false,
        });
      }
      if (check.key === 'range') {
        return decided('find.check.range', 'find', 'request_action', {
          instruction: check.title,
          needsReady: false,
        });
      }
      return decided(`find.check.${check.key}`, 'find', 'ask_user', {
        question: check.title,
        detail: check.detail,
        answers: [...check.answers],
      });
    },
  },
  {
    id: 'find.last-scan',
    stage: 'find',
    when: ({ state }) =>
      !state.device &&
      state.scans.length === 2 &&
      state.scans.every(({ outcome }) => outcome === 'cancelled') &&
      !pendingCheck(state),
    then: () => decided('find.last-scan', 'find', 'scan_all_devices', { last: true }),
  },
  {
    id: 'find.assess-reachability',
    stage: 'find',
    when: ({ state }) => !state.device && state.scans.length > 0 && !state.reachability,
    then: () => decided('find.assess-reachability', 'find', 'assess_reachability', {}),
  },
];
