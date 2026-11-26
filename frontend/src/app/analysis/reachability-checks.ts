export type ReachabilityCheckResult = 'confirmed' | 'needs-action' | 'blocked' | 'unknown';

export const REACHABILITY_CHECKS = [
  {
    key: 'power',
    title: 'Is the console on and awake?',
    detail:
      'Press any key on the console. Many go to sleep after a few minutes and stop showing up.',
    answers: ['Yes, it’s awake', 'I just woke it', 'It won’t turn on'],
    confirmed: ['Yes, it’s awake', 'I just woke it'],
    issue: 'It won’t turn on',
    remedy: 'Switch the device on or wake the console, then tap Done.',
    cause: 'off or asleep',
  },
  {
    key: 'connections',
    title: 'Is any other app or watch connected to it?',
    detail: 'Check nearby phones and watches. Many devices allow just one connection.',
    answers: ['No, nothing else is connected', 'Yes, something is connected'],
    confirmed: ['No, nothing else is connected'],
    issue: 'Yes, something is connected',
    remedy: 'Disconnect other apps or watches from the device, then tap Done.',
    cause: 'held by another central',
  },
  {
    key: 'range',
    title: 'Stand within 2 metres of the console',
    detail: '',
    answers: ['Done'],
    confirmed: ['Done'],
    issue: null,
    remedy: null,
    cause: 'out of range',
  },
] as const;

export type ReachabilityCheck = (typeof REACHABILITY_CHECKS)[number]['key'];
