import type { ChosenDevice } from '../ble/chosen-device';
import type { ReachabilityAssessment } from '../analysis/reachability-assessment';
import type { FieldCandidate } from '../analysis/field-candidate';
import {
  REACHABILITY_CHECKS,
  type ReachabilityCheck,
  type ReachabilityCheckResult,
} from '../analysis/reachability-checks';
import type { GattServiceInfo } from '../ble/gatt-layout';
import type { SupportedRange } from '../knowledge-base/supported-range';
import type { VendorMatch } from '../knowledge-base/vendor-match';
import type { ReadableMetric } from '../outcome/readable-metric';
import type { Stage } from '../store/model/stage';
import type { Step } from '../store/model/step';
import type { ControlEffect } from '../store/model/control-effect';
import type { DeviceProfile } from '../store/model/device-profile';
import type { DeviceInformation } from './device-information';
import type { ProfileCandidate } from './profile-candidate';
import { PROPRIETARY_LEVELS, type ProprietaryLevel } from './proprietary-levels';
import type { ProprietaryRecording } from './proprietary-recording';

export interface ScanAttempt {
  readonly mode: 'filtered' | 'acceptAll';
  readonly outcome: 'chosen' | 'cancelled' | 'failed';
}

// What the playbook rules decide from (build-the-decision-state design): a fold of the committed
// steps, so an investigation reopened from the store gives the same state.
export interface DecisionState {
  readonly stage: Stage;
  readonly stepCount: number;
  readonly capabilitiesChecked: boolean;
  readonly advertisementsAvailable: boolean;
  /** `undefined` until asked; `null` for "Don't know" or a skip. */
  readonly machineType: string | null | undefined;
  readonly brand: string | null | undefined;
  readonly poweredOn: boolean;
  readonly scans: readonly ScanAttempt[];
  readonly reachabilityChecks: Readonly<
    Partial<Record<ReachabilityCheck, ReachabilityCheckResult>>
  >;
  readonly reachability: ReachabilityAssessment | null;
  readonly candidateHelp: boolean;
  readonly reportedCandidates: readonly string[] | null;
  readonly powerCycleAttempted: boolean;
  readonly automaticMatchAttempted: boolean;
  readonly device: ChosenDevice | null;
  readonly connectAttempts: number;
  readonly connectFailures: number;
  readonly heldPrompts: number;
  readonly connected: boolean;
  readonly everConnected: boolean;
  readonly layout: readonly GattServiceInfo[] | null;
  readonly unreachable: readonly string[];
  readonly deviceInfo: DeviceInformation | 'absent' | null;
  readonly candidates: readonly ProfileCandidate[] | null;
  readonly vendorMatches: readonly VendorMatch[] | null;
  readonly handshakeAttempted: boolean;
  readonly requiredHandshake: DeviceProfile['handshake'];
  readonly ambiguityResolved: boolean;
  readonly selectedProtocol: string | null;
  readonly reads: readonly string[];
  readonly rangesAttempted: boolean;
  readonly machineFeatures: readonly string[];
  readonly targetSettingFeatures: readonly string[];
  readonly supportedRanges: Readonly<Record<string, SupportedRange>>;
  readonly machineFeatureEvidence: readonly string[];
  readonly standardRecording: 'pending' | 'ready' | 'skipped' | 'recorded' | 'attempted';
  readonly standardRecordingId: string | null;
  readonly proprietaryRecordings: Readonly<Partial<Record<ProprietaryLevel, ProprietaryRecording>>>;
  readonly proprietaryCompared: boolean;
  readonly proprietaryRanking: readonly FieldCandidate[] | null;
  readonly proprietaryEncodingAttempted: boolean;
  readonly proprietaryFramingAttempted: boolean;
  readonly proprietaryQuickComparison: 'ready' | 'done' | null;
  readonly speedAction: number | 'skipped' | null;
  readonly speedConfirmation: 'confirmed' | 'notConfirmed' | 'reported' | null;
  readonly readableMetrics: readonly ReadableMetric[];
  readonly inclineAction: number | 'skipped' | null;
  readonly inclineConfirmation: 'confirmed' | 'notConfirmed' | 'reported' | null;
  readonly inclineBaseline: number | null;
  readonly controlChoice: 'test' | 'skip' | null;
  readonly controlRequested: boolean;
  readonly controlGrantedAt: number | null;
  readonly controlAttempted: boolean;
  readonly controlTest: (ControlEffect & { readonly sentAt: number }) | null;
  readonly controlAnswer: string | null;
  readonly controlEffectStatus: 'confirmed' | 'notSeen' | 'opposite' | null;
  readonly controlStopped: boolean;
  readonly finished: boolean;
}

export const INITIAL_STATE: DecisionState = {
  stage: 'prepare',
  stepCount: 0,
  capabilitiesChecked: false,
  advertisementsAvailable: false,
  machineType: undefined,
  brand: undefined,
  poweredOn: false,
  scans: [],
  reachabilityChecks: {},
  reachability: null,
  candidateHelp: false,
  reportedCandidates: null,
  powerCycleAttempted: false,
  automaticMatchAttempted: false,
  device: null,
  connectAttempts: 0,
  connectFailures: 0,
  heldPrompts: 0,
  connected: false,
  everConnected: false,
  layout: null,
  unreachable: [],
  deviceInfo: null,
  candidates: null,
  vendorMatches: null,
  handshakeAttempted: false,
  requiredHandshake: null,
  ambiguityResolved: false,
  selectedProtocol: null,
  reads: [],
  rangesAttempted: false,
  machineFeatures: [],
  targetSettingFeatures: [],
  supportedRanges: {},
  machineFeatureEvidence: [],
  standardRecording: 'pending',
  standardRecordingId: null,
  proprietaryRecordings: {},
  proprietaryCompared: false,
  proprietaryRanking: null,
  proprietaryEncodingAttempted: false,
  proprietaryFramingAttempted: false,
  proprietaryQuickComparison: null,
  speedAction: null,
  speedConfirmation: null,
  readableMetrics: [],
  inclineAction: null,
  inclineConfirmation: null,
  inclineBaseline: null,
  controlChoice: null,
  controlRequested: false,
  controlGrantedAt: null,
  controlAttempted: false,
  controlTest: null,
  controlAnswer: null,
  controlEffectStatus: null,
  controlStopped: false,
  finished: false,
};

const MACHINE_TYPES: Readonly<Record<string, string>> = {
  Treadmill: 'treadmill',
  Bike: 'bike',
  Rower: 'rower',
  'Cross-trainer': 'cross-trainer',
  'Heart-rate sensor': 'heart-rate-sensor',
  Other: 'other',
};

export const DONT_KNOW = 'Don’t know';

/** The state after one more committed step. Pure. */
export function applyStep(state: DecisionState, step: Step): DecisionState {
  const next: DecisionState = { ...state, stage: step.stage, stepCount: step.n };
  if (
    step.status === 'interrupted' &&
    step.tool !== 'send_command' &&
    step.tool !== 'request_control' &&
    step.tool !== 'replay_known_handshake'
  )
    return next;
  const data = step.result.ok ? (step.result.data as Record<string, unknown>) : null;
  const answer = step.exchange && !step.exchange.skipped ? step.exchange.answer : null;
  const check = REACHABILITY_CHECKS.find(({ key }) => step.ruleId === `find.check.${key}`);
  if (check) {
    const confirmed = check.confirmed.some((value) => value === answer);
    const status = confirmed
      ? 'confirmed'
      : answer && answer === check.issue
        ? 'needs-action'
        : 'unknown';
    return { ...next, reachabilityChecks: { ...state.reachabilityChecks, [check.key]: status } };
  }
  const repair = REACHABILITY_CHECKS.find(({ key }) => step.ruleId === `find.repair.${key}`);
  if (repair) {
    return {
      ...next,
      reachabilityChecks: {
        ...state.reachabilityChecks,
        [repair.key]: answer === 'Done' ? 'confirmed' : 'blocked',
      },
    };
  }
  switch (step.tool) {
    case 'assess_reachability':
      return { ...next, reachability: data as unknown as ReachabilityAssessment | null };
    case 'find_varying_bytes':
      return { ...next, proprietaryCompared: true };
    case 'correlate_with_action':
      return {
        ...next,
        proprietaryRanking: (data?.['ranked'] as FieldCandidate[] | undefined) ?? [],
      };
    case 'guess_field_encoding':
      return { ...next, proprietaryEncodingAttempted: true };
    case 'detect_framing':
      return { ...next, proprietaryFramingAttempted: true };
    case 'baseline_vs_activity':
      return { ...next, proprietaryQuickComparison: 'done' };
    case 'check_capabilities':
      return {
        ...next,
        capabilitiesChecked: true,
        advertisementsAvailable:
          data?.['watchAdvertisements'] === true || data?.['requestLEScan'] === true,
      };
    case 'ask_user':
      if (step.ruleId === 'prepare.machine-type') {
        return { ...next, machineType: answer ? (MACHINE_TYPES[answer] ?? 'other') : null };
      }
      if (step.ruleId === 'prepare.brand') {
        return { ...next, brand: answer && answer !== DONT_KNOW ? answer : null };
      }
      if (step.ruleId === 'standard.speed-follow-up') {
        return { ...next, speedConfirmation: 'reported' };
      }
      if (step.ruleId === 'standard.incline-follow-up') {
        return { ...next, inclineConfirmation: 'reported' };
      }
      if (step.ruleId === 'control.offer') {
        return { ...next, controlChoice: answer === 'Test control' ? 'test' : 'skip' };
      }
      if (step.ruleId === 'control.confirm') {
        return { ...next, controlAnswer: answer ?? DONT_KNOW };
      }
      return next;
    case 'request_action':
      if (step.stage === 'proprietary') {
        if (step.ruleId === 'proprietary.quick-ready')
          return {
            ...next,
            proprietaryQuickComparison: typeof data?.['readyAt'] === 'number' ? 'ready' : 'done',
          };
        const level = PROPRIETARY_LEVELS.find(
          (level) => step.ruleId === `proprietary.ready.${level}`,
        );
        if (level)
          return {
            ...next,
            proprietaryRecordings: {
              ...state.proprietaryRecordings,
              [level]: { status: answer === 'Ready' ? 'ready' : 'skipped' },
            },
          };
      }
      if (step.ruleId === 'standard.ready') {
        return { ...next, standardRecording: answer === 'Ready' ? 'ready' : 'skipped' };
      }
      if (step.ruleId === 'standard.speed-action' || step.ruleId === 'standard.incline-action') {
        const doneAt = data?.['doneAt'];
        const key = step.ruleId === 'standard.speed-action' ? 'speedAction' : 'inclineAction';
        return { ...next, [key]: answer && typeof doneAt === 'number' ? doneAt : 'skipped' };
      }
      if (step.ruleId === 'prepare.power-on') return { ...next, poweredOn: true };
      if (step.ruleId === 'identify.held-by-other') {
        return { ...next, heldPrompts: state.heldPrompts + 1 };
      }
      return next;
    case 'scan_devices':
    case 'scan_all_devices': {
      if (data?.['candidateHelp'] === true) return { ...next, candidateHelp: true };
      const mode =
        (data?.['mode'] as ScanAttempt['mode'] | undefined) ??
        (step.tool === 'scan_devices' ? 'filtered' : 'acceptAll');
      const outcome: ScanAttempt['outcome'] = step.result.ok
        ? 'chosen'
        : step.result.error.code === 'USER_CANCELLED'
          ? 'cancelled'
          : 'failed';
      return {
        ...next,
        scans: [...state.scans, { mode, outcome }],
        device: step.result.ok
          ? {
              deviceId: String(data?.['deviceId']),
              name: (data?.['name'] as string | null) ?? null,
              advertisedServices: (data?.['advertisedServices'] as string[]) ?? [],
            }
          : state.device,
        unreachable: (data?.['excludedAsBlocklisted'] as string[] | undefined) ?? state.unreachable,
      };
    }
    case 'report_candidate_names':
      return { ...next, reportedCandidates: (data?.['names'] as string[] | undefined) ?? [] };
    case 'power_cycle_match':
      return {
        ...next,
        powerCycleAttempted:
          state.powerCycleAttempted || (step.input as { mode?: string }).mode === 'guided',
        automaticMatchAttempted:
          state.automaticMatchAttempted || (step.input as { mode?: string }).mode === 'automatic',
        device: (data?.['device'] as ChosenDevice | undefined) ?? state.device,
      };
    case 'connect':
      return {
        ...next,
        connectAttempts: state.connectAttempts + 1,
        connectFailures: state.connectFailures + (step.result.ok ? 0 : 1),
        connected: step.result.ok,
        everConnected: state.everConnected || step.result.ok,
      };
    case 'enumerate_gatt':
      return step.result.ok
        ? {
            ...next,
            layout: data?.['services'] as GattServiceInfo[],
            unreachable: (data?.['requestedButUnreachable'] as string[]) ?? state.unreachable,
          }
        : next;
    case 'read_device_info':
      return {
        ...next,
        deviceInfo: step.result.ok ? (data as DeviceInformation) : 'absent',
        candidates: step.result.ok ? null : state.candidates,
      };
    case 'match_known_profiles':
      return step.result.ok
        ? { ...next, candidates: data?.['candidates'] as ProfileCandidate[] }
        : next;
    case 'vendor_signature_lookup':
      return { ...next, vendorMatches: (data?.['matches'] as VendorMatch[] | undefined) ?? [] };
    case 'replay_known_handshake':
      return {
        ...next,
        handshakeAttempted: true,
        requiredHandshake:
          data?.['dataStarted'] === true
            ? (data['handshake'] as DeviceProfile['handshake'])
            : state.requiredHandshake,
        proprietaryRecordings: data?.['dataStarted'] === true ? {} : state.proprietaryRecordings,
      };
    case 'read_characteristic': {
      const input = step.input as { characteristic: string };
      return { ...next, reads: [...state.reads, input.characteristic] };
    }
    case 'read_supported_ranges':
      return {
        ...next,
        rangesAttempted: true,
        machineFeatures: (data?.['machineFeatures'] as string[] | undefined) ?? [],
        targetSettingFeatures: (data?.['targetSettingFeatures'] as string[] | undefined) ?? [],
        supportedRanges: (data?.['ranges'] as Record<string, SupportedRange> | undefined) ?? {},
        machineFeatureEvidence: step.result.ok ? step.result.evidence.slice(0, 1) : [],
      };
    case 'reconnect':
      return { ...next, connected: !!data?.['connected'], controlGrantedAt: null };
    case 'disconnect':
      return { ...next, connected: false, controlGrantedAt: null };
    case 'request_control':
      return {
        ...next,
        controlRequested: true,
        controlGrantedAt:
          data?.['result'] === 'success' && typeof data['connectedAt'] === 'number'
            ? data['connectedAt']
            : null,
      };
    case 'send_command': {
      if (step.ruleId === 'control.stop') return { ...next, controlStopped: true };
      const effect = data?.['effect'] as ControlEffect | undefined;
      const sentAt = data?.['sentAt'];
      return {
        ...next,
        controlAttempted: true,
        controlTest: effect && typeof sentAt === 'number' ? { ...effect, sentAt } : null,
      };
    }
    case 'request_missing_tool':
      return step.ruleId === 'control.test' ? { ...next, controlAttempted: true } : next;
    case 'check_command_effect':
      return {
        ...next,
        controlEffectStatus:
          data?.['status'] === 'confirmed' || data?.['status'] === 'opposite'
            ? data['status']
            : 'notSeen',
      };
    case 'update_hypothesis':
      return step.result.ok &&
        step.ruleId === 'identify.ambiguous' &&
        typeof data?.['protocol'] === 'string'
        ? { ...next, ambiguityResolved: true, selectedProtocol: data['protocol'] }
        : next;
    case 'subscribe_and_record': {
      if (step.stage === 'proprietary') {
        const level = PROPRIETARY_LEVELS.find(
          (level) => step.ruleId === `proprietary.record.${level}`,
        );
        if (!level) return next;
        const recording =
          data?.['interrupted'] !== true && typeof data?.['recordingId'] === 'string'
            ? {
                status: 'recorded' as const,
                id: data['recordingId'],
                count: Number(data['count']),
                seconds: Number((step.input as { seconds: number }).seconds),
              }
            : { status: 'failed' as const };
        return {
          ...next,
          proprietaryRecordings: { ...state.proprietaryRecordings, [level]: recording },
        };
      }
      return {
        ...next,
        standardRecordingId: typeof data?.['recordingId'] === 'string' ? data['recordingId'] : null,
        standardRecording:
          data?.['silent'] === false &&
          data['interrupted'] !== true &&
          data['count'] !== data['decodeErrors']
            ? 'recorded'
            : 'attempted',
      };
    }
    case 'decode_standard': {
      const key =
        step.ruleId === 'standard.confirm-incline' ? 'inclineConfirmation' : 'speedConfirmation';
      return {
        ...next,
        [key]: data?.['confirmed'] === true ? 'confirmed' : 'notConfirmed',
        readableMetrics:
          (data?.['readableMetrics'] as ReadableMetric[] | undefined) ?? state.readableMetrics,
        inclineBaseline:
          typeof data?.['inclineBaseline'] === 'number'
            ? data['inclineBaseline']
            : state.inclineBaseline,
      };
    }
    case 'finish':
      return step.result.ok ? { ...next, finished: true, connected: false } : next;
    default:
      return next;
  }
}

export function stateFrom(steps: readonly Step[]): DecisionState {
  return [...steps].sort((a, b) => a.n - b.n).reduce(applyStep, INITIAL_STATE);
}
