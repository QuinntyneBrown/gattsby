import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG } from './tool-catalog';
import type { ToolDefinition } from './tool-definition';
import { ToolRegistry } from './tool-registry';

const MVP_TOOLS = [
  'check_capabilities',
  'scan_devices',
  'scan_all_devices',
  'connect',
  'disconnect',
  'enumerate_gatt',
  'read_device_info',
  'read_characteristic',
  'match_known_profiles',
  'subscribe_and_record',
  'decode_standard',
  'ask_user',
  'request_action',
  'update_hypothesis',
  'finish',
];

describe('ToolRegistry (FR-070)', () => {
  it('loads the real catalog with every field of FR-070', () => {
    const registry = new ToolRegistry(TOOL_CATALOG);
    expect(registry.all().map((t) => t.name)).toEqual(MVP_TOOLS);
    for (const tool of registry.all()) {
      expect(tool.group).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.outputSchema).toBeTruthy();
      expect(tool.safetyClass).toBeTruthy();
      expect(tool.preconditions).toBeDefined();
      expect(tool.stages.length).toBeGreaterThan(0);
      expect(tool.requiredCapabilities).toBeDefined();
      expect(tool.phase).toBe('MVP');
    }
  });

  it('lists no control tool at the identify stage', () => {
    const registry = new ToolRegistry(TOOL_CATALOG);
    expect(registry.forStage('identify').some((t) => t.safetyClass === 'control')).toBe(false);
  });

  it('refuses an entry whose name is not snake case', () => {
    const broken = { ...TOOL_CATALOG[0], name: 'Check-Capabilities' } as ToolDefinition;
    expect(() => new ToolRegistry([broken])).toThrow(/snake case/);
  });

  it('refuses n/a as the safety class of a device tool', () => {
    const broken = { ...TOOL_CATALOG[1], safetyClass: 'n/a' } as ToolDefinition;
    expect(() => new ToolRegistry([broken])).toThrow(/Person and Meta/);
  });

  it('refuses two tools with the same name', () => {
    expect(() => new ToolRegistry([TOOL_CATALOG[0], TOOL_CATALOG[0]])).toThrow(/not unique/);
  });

  it('hides a P2 tool until P2 is enabled', () => {
    const p2 = { ...TOOL_CATALOG[0], name: 'watch_advertisements', phase: 'P2' } as ToolDefinition;
    expect(new ToolRegistry([p2]).get('watch_advertisements')).toBeUndefined();
    expect(new ToolRegistry([p2], ['MVP', 'P2']).get('watch_advertisements')).toBe(p2);
  });
});
