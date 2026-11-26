const LABELS: Readonly<Record<string, string>> = {
  setTargetSpeed: 'Target speed',
  setTargetIncline: 'Target incline',
  setTargetResistance: 'Target resistance',
  setTargetPower: 'Target power',
  start: 'Start',
  stop: 'Stop',
};

export function controlFeatureLabel(id: string): string {
  return LABELS[id] ?? id;
}
