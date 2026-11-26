import type { Capabilities } from './capabilities';
import type { CapabilityItem } from './capability-item';
import { formatStorage } from '../shared/format-storage';
import { readinessIssue } from './readiness-issue';

export function toCapabilityItems(
  c: Capabilities | null,
  model: Capabilities['model']['availability'] | 'failed' | 'idle',
  progress: number,
): CapabilityItem[] {
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
  const issue = readinessIssue(c);
  const phoneModel = c.model.source === 'phone';
  const browser = [
    c.platform.browser === 'unknown' ? 'Chrome' : c.platform.browser,
    c.platform.version !== 'unknown' ? c.platform.version : '',
  ]
    .filter(Boolean)
    .join(' ');
  return [
    {
      label: 'Browser',
      detail:
        issue === 'insecure'
          ? 'Bluetooth requires HTTPS'
          : issue === 'unsupported'
            ? `${browser} on ${c.platform.os} · Open in Chrome on a laptop or Android`
            : issue === 'outdated'
              ? `${browser} on ${c.platform.os} · Update to Chrome 148 or later`
              : `${browser} on ${c.platform.os} · Web Bluetooth available`,
      status: !c.secureContext || !c.bluetooth.api ? 'na' : issue === 'outdated' ? 'warn' : 'ok',
    },
    {
      label: 'Bluetooth',
      detail: !c.secureContext
        ? 'Needs HTTPS'
        : !c.bluetooth.api
          ? 'Not reachable from this browser'
          : c.bluetooth.blocked
            ? 'Allow Bluetooth for this site'
            : c.bluetooth.adapterAvailable
              ? 'On · adapter ready'
              : 'Turn on Bluetooth',
      status:
        !c.secureContext || !c.bluetooth.api
          ? 'na'
          : c.bluetooth.adapterAvailable && !c.bluetooth.blocked
            ? 'ok'
            : 'warn',
    },
    {
      label: 'On-device model',
      detail: {
        available: phoneModel
          ? 'Phone model ready · runs offline'
          : 'Gemini Nano ready · runs offline',
        downloadable: c.model.downloadBytes
          ? `Download needed · ${formatStorage(c.model.downloadBytes)}`
          : 'Download needed',
        downloading: phoneModel ? 'Downloading the phone model' : 'Downloading Gemini Nano',
        failed: `Download failed at ${progress}%`,
        unavailable:
          c.model.reason === 'webgpu'
            ? 'WebGPU unavailable · use checklist mode'
            : 'Not available on this device · use checklist mode',
        idle: 'Not available on this device · use checklist mode',
      }[model],
      status:
        model === 'available'
          ? 'ok'
          : model === 'unavailable'
            ? 'na'
            : model === 'downloading'
              ? 'pending'
              : 'warn',
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
