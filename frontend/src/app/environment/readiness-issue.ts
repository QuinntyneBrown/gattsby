import type { Capabilities } from './capabilities';

export function readinessIssue(c: Capabilities) {
  if (!c.secureContext) return 'insecure';
  if (!c.bluetooth.api) return 'unsupported';
  if (c.platform.browser === 'Chrome' && Number(c.platform.version) < 148) return 'outdated';
  if (!c.storage.open) return 'storage';
  if (c.bluetooth.blocked) return 'permission';
  if (!c.bluetooth.adapterAvailable) return 'bluetooth-off';
  return null;
}

export function canStartInvestigation(c: Capabilities): boolean {
  const issue = readinessIssue(c);
  return issue === null || issue === 'permission';
}
