// How much a tool can change the device (AGENTS.md "Words"); `n/a` for person and meta tools.
export type SafetyClass = 'read' | 'listen' | 'write' | 'control' | 'n/a';

export type ToolGroup =
  | 'Environment'
  | 'Discovery'
  | 'Connection'
  | 'Inspection'
  | 'Listening'
  | 'Analysis'
  | 'Control'
  | 'Person'
  | 'Meta';
