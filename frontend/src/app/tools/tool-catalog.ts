import { scanAllDevicesTool } from './discovery/scan-all-devices.tool';
import { scanDevicesTool } from './discovery/scan-devices.tool';
import { connectTool } from './connection/connect.tool';
import { disconnectTool } from './connection/disconnect.tool';
import { checkCapabilitiesTool } from './environment/check-capabilities.tool';
import { enumerateGattTool } from './inspection/enumerate-gatt.tool';
import { matchKnownProfilesTool } from './inspection/match-known-profiles.tool';
import { readCharacteristicTool } from './inspection/read-characteristic.tool';
import { readDeviceInfoTool } from './inspection/read-device-info.tool';
import { readSupportedRangesTool } from './inspection/read-supported-ranges.tool';
import { subscribeAndRecordTool } from './listening/subscribe-and-record.tool';
import { decodeStandardTool } from './analysis/decode-standard.tool';
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
  connectTool,
  disconnectTool,
  enumerateGattTool,
  readDeviceInfoTool,
  readCharacteristicTool,
  matchKnownProfilesTool,
  readSupportedRangesTool,
  subscribeAndRecordTool,
  decodeStandardTool,
  askUserTool,
  requestActionTool,
  updateHypothesisTool,
  requestMissingTool,
  finishTool,
];
