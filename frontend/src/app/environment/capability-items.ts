import type { Capabilities } from './capabilities';
import type { CapabilityItem } from './capability-item';

export function toCapabilityItems(c: Capabilities | null): CapabilityItem[] {
  if (!c) {
    return [
      'Browser',
      'Bluetooth',
      'On-device model',
      'Advertisement scanning',
      'Camera',
      'Storage',
    ].map((label) => ({ label, detail: 'Checking…', status: 'pending' }));
  }
  const browser = [
    c.platform.browser === 'unknown' ? 'Chrome' : c.platform.browser,
    c.platform.version !== 'unknown' ? c.platform.version : '',
  ]
    .filter(Boolean)
    .join(' ');
  return [
    {
      label: 'Browser',
      detail: `${browser} on ${c.platform.os} · Web Bluetooth ${c.bluetooth.api ? 'available' : 'unavailable'}`,
      status: c.bluetooth.api ? 'ok' : 'na',
    },
    {
      label: 'Bluetooth',
      detail: c.bluetooth.adapterAvailable ? 'On · adapter ready' : 'Turn on Bluetooth',
      status: c.bluetooth.adapterAvailable ? 'ok' : 'warn',
    },
    {
      label: 'On-device model',
      detail:
        c.model.availability === 'available'
          ? 'Gemini Nano ready · runs offline'
          : 'Use checklist mode',
      status: c.model.availability === 'available' ? 'ok' : 'na',
    },
    {
      label: 'Advertisement scanning',
      detail:
        c.watchAdvertisements || c.requestLEScan
          ? 'Bluetooth advertisements can be observed'
          : 'Only in Chrome with experimental features turned on',
      status: c.watchAdvertisements || c.requestLEScan ? 'ok' : 'na',
    },
    {
      label: 'Camera',
      detail: c.camera
        ? 'For photos of a model plate'
        : 'Type details from the model plate instead',
      status: c.camera ? 'ok' : 'na',
    },
    {
      label: 'Storage',
      detail: c.storage.open
        ? 'Kept on this device until you delete it'
        : 'Allow this site to save data',
      status: c.storage.open ? 'ok' : 'na',
    },
  ];
}
