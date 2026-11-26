import { scanAllDevicesTool } from './discovery/scan-all-devices.tool';
import { scanDevicesTool } from './discovery/scan-devices.tool';
import { reportCandidateNamesTool } from './discovery/report-candidate-names.tool';
import { powerCycleMatchTool } from './discovery/power-cycle-match.tool';
import { watchAdvertisementsTool } from './discovery/watch-advertisements.tool';
import { getPermittedDevicesTool } from './discovery/get-permitted-devices.tool';
import { pickResumeDeviceTool } from './discovery/pick-resume-device.tool';
import { connectTool } from './connection/connect.tool';
import { reconnectTool } from './connection/reconnect.tool';
import { disconnectTool } from './connection/disconnect.tool';
import { requestControlTool } from './control/request-control.tool';
import { sendCommandTool } from './control/send-command.tool';
import { checkCommandEffectTool } from './control/check-command-effect.tool';
import { replayKnownHandshakeTool } from './control/replay-known-handshake.tool';
import { checkCapabilitiesTool } from './environment/check-capabilities.tool';
import { enumerateGattTool } from './inspection/enumerate-gatt.tool';
import { matchKnownProfilesTool } from './inspection/match-known-profiles.tool';
import { readCharacteristicTool } from './inspection/read-characteristic.tool';
import { readDeviceInfoTool } from './inspection/read-device-info.tool';
import { readSupportedRangesTool } from './inspection/read-supported-ranges.tool';
import { subscribeAndRecordTool } from './listening/subscribe-and-record.tool';
import { baselineVsActivityTool } from './listening/baseline-vs-activity.tool';
import { decodeStandardTool } from './analysis/decode-standard.tool';
import { assessReachabilityTool } from './analysis/assess-reachability.tool';
import { vendorSignatureLookupTool } from './analysis/vendor-signature-lookup.tool';
import { findVaryingBytesTool } from './analysis/find-varying-bytes.tool';
import { correlateWithActionTool } from './analysis/correlate-with-action.tool';
import { detectFramingTool } from './analysis/detect-framing.tool';
import { guessFieldEncodingTool } from './analysis/guess-field-encoding.tool';
import { finishTool } from './meta/finish.tool';
import { requestMissingTool } from './meta/request-missing-tool.tool';
import { updateHypothesisTool } from './meta/update-hypothesis.tool';
import { askUserTool } from './person/ask-user.tool';
import { requestActionTool } from './person/request-action.tool';
import type { ToolDefinition } from './tool-definition';

// Every registry entry, in catalog order (register-and-list-tools design). Adding a tool adds one
// import and one element here; the loop does not change (NFR-022).
export const TOOL_CATALOG: readonly ToolDefinition[] = [
  checkCapabilitiesTool,
  scanDevicesTool,
  scanAllDevicesTool,
  reportCandidateNamesTool,
  powerCycleMatchTool,
  watchAdvertisementsTool,
  getPermittedDevicesTool,
  pickResumeDeviceTool,
  connectTool,
  reconnectTool,
  disconnectTool,
  enumerateGattTool,
  readDeviceInfoTool,
  readCharacteristicTool,
  matchKnownProfilesTool,
  readSupportedRangesTool,
  subscribeAndRecordTool,
  baselineVsActivityTool,
  decodeStandardTool,
  assessReachabilityTool,
  vendorSignatureLookupTool,
  findVaryingBytesTool,
  correlateWithActionTool,
  guessFieldEncodingTool,
  detectFramingTool,
  requestControlTool,
  sendCommandTool,
  checkCommandEffectTool,
  replayKnownHandshakeTool,
  askUserTool,
  requestActionTool,
  updateHypothesisTool,
  requestMissingTool,
  finishTool,
];
