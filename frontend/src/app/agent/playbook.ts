export const CHECKLIST_LABELS: Readonly<Record<string, { label: string; purpose: string }>> = {
  connect: {
    label: 'Connect to the device',
    purpose: 'Open a read-only connection to the device you picked.',
  },
  enumerate_gatt: {
    label: 'List exposed services',
    purpose: 'Find what the device is willing to share.',
  },
  read_device_info: {
    label: 'Read device information',
    purpose: 'It’s read-only and takes a second.',
  },
  match_known_profiles: {
    label: 'Match known profiles',
    purpose: 'Compare what the device exposes with known protocols.',
  },
  replay_known_handshake: {
    label: 'Review the data subscription',
    purpose: 'See the documented request and approve it if you want the device to send data.',
  },
  read_supported_ranges: {
    label: 'Read supported ranges',
    purpose: 'Read the features and ranges reported by the machine.',
  },
  read_characteristic: {
    label: 'Read supported features',
    purpose: 'Check which features the device reports.',
  },
};
