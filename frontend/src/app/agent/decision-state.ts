import type { ChosenDevice } from '../ble/chosen-device';
import type { GattServiceInfo } from '../ble/gatt-layout';
import type { Stage } from '../store/model/stage';
import type { Step } from '../store/model/step';
import type { DeviceInformation } from './device-information';
import type { ProfileCandidate } from './profile-candidate';

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
  /** `undefined` until asked; `null` for "Don't know" or a skip. */
  readonly machineType: string | null | undefined;
  readonly brand: string | null | undefined;
  readonly poweredOn: boolean;
  readonly scans: readonly ScanAttempt[];
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
  readonly ambiguityResolved: boolean;
  readonly reads: readonly string[];
  readonly rangesAttempted: boolean;
  readonly standardRecording: 'pending' | 'ready' | 'skipped' | 'recorded' | 'attempted';
  readonly speedAction: number | 'skipped' | null;
  readonly speedConfirmation: 'confirmed' | 'notConfirmed' | 'reported' | null;
  readonly finished: boolean;
}

export const INITIAL_STATE: DecisionState = {
  stage: 'prepare',
  stepCount: 0,
  capabilitiesChecked: false,
  machineType: undefined,
  brand: undefined,
  poweredOn: false,
  scans: [],
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
  ambiguityResolved: false,
  reads: [],
  rangesAttempted: false,
  standardRecording: 'pending',
  speedAction: null,
  speedConfirmation: null,
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
  const data = step.result.ok ? (step.result.data as Record<string, unknown>) : null;
  const answer = step.exchange && !step.exchange.skipped ? step.exchange.answer : null;
  switch (step.tool) {
    case 'check_capabilities':
      return { ...next, capabilitiesChecked: true };
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
      return next;
    case 'request_action':
      if (step.ruleId === 'standard.ready') {
        return { ...next, standardRecording: answer === 'Ready' ? 'ready' : 'skipped' };
      }
      if (step.ruleId === 'standard.speed-action') {
        const doneAt = data?.['doneAt'];
        return { ...next, speedAction: answer && typeof doneAt === 'number' ? doneAt : 'skipped' };
      }
      if (step.ruleId === 'prepare.power-on') return { ...next, poweredOn: true };
      if (step.ruleId === 'identify.held-by-other') {
        return { ...next, heldPrompts: state.heldPrompts + 1 };
      }
      return next;
    case 'scan_devices':
    case 'scan_all_devices': {
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
      return { ...next, deviceInfo: step.result.ok ? (data as DeviceInformation) : 'absent' };
    case 'match_known_profiles':
      return step.result.ok
        ? { ...next, candidates: data?.['candidates'] as ProfileCandidate[] }
        : next;
    case 'read_characteristic': {
      const input = step.input as { characteristic: string };
      return { ...next, reads: [...state.reads, input.characteristic] };
    }
    case 'read_supported_ranges':
      return { ...next, rangesAttempted: true };
    case 'disconnect':
      return { ...next, connected: false };
    case 'subscribe_and_record':
      return {
        ...next,
        standardRecording:
          data?.['silent'] === false &&
          data['interrupted'] !== true &&
          data['count'] !== data['decodeErrors']
            ? 'recorded'
            : 'attempted',
      };
    case 'decode_standard':
      return {
        ...next,
        speedConfirmation: data?.['confirmed'] === true ? 'confirmed' : 'notConfirmed',
      };
    case 'finish':
      return { ...next, finished: true, connected: false };
    default:
      return step.decidedBy === 'orchestrator' && step.ruleId === 'identify.ambiguous'
        ? { ...next, ambiguityResolved: true }
        : next;
  }
}

export function stateFrom(steps: readonly Step[]): DecisionState {
  return [...steps].sort((a, b) => a.n - b.n).reduce(applyStep, INITIAL_STATE);
}
