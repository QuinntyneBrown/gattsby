import type { Capabilities } from '../environment/capabilities';
import type { Stage } from '../store/model/stage';
import type { ToolDefinition } from './tool-definition';
import type { ToolRegistry } from './tool-registry';

export function capabilityAvailable(name: string, capabilities: Capabilities): boolean {
  switch (name) {
    case 'bluetooth':
      return (
        capabilities.secureContext &&
        capabilities.bluetooth.api &&
        capabilities.bluetooth.adapterAvailable &&
        !capabilities.bluetooth.blocked
      );
    case 'model':
      return capabilities.model.availability === 'available';
    case 'watchAdvertisements':
      return capabilities.watchAdvertisements;
    case 'requestLEScan':
      return capabilities.requestLEScan;
    case 'getDevices':
      return capabilities.getDevices;
    case 'camera':
      return capabilities.camera;
    case 'storage':
      return capabilities.storage.open;
    default:
      return false;
  }
}

export function visibleTools(
  registry: ToolRegistry,
  stage: Stage,
  capabilities: Capabilities,
): ToolDefinition[] {
  return registry
    .forStage(stage)
    .filter(
      (tool) =>
        tool.modelSelectable !== false &&
        tool.safetyClass !== 'write' &&
        tool.safetyClass !== 'control' &&
        tool.requiredCapabilities.every((name) => capabilityAvailable(name, capabilities)),
    );
}
