import { decided, type StageRule } from '../stage-rule';

export const MACHINE_TYPE_ANSWERS = [
  'Treadmill',
  'Bike',
  'Rower',
  'Cross-trainer',
  'Heart-rate sensor',
  'Other',
] as const;

// Prepare: fully deterministic in both modes (FR-008; start-an-investigation design).
export const PREPARE_RULES: readonly StageRule[] = [
  {
    id: 'prepare.capabilities',
    stage: 'prepare',
    when: ({ state }) => !state.capabilitiesChecked,
    then: () => decided('prepare.capabilities', 'prepare', 'check_capabilities', {}),
  },
  {
    id: 'prepare.machine-type',
    stage: 'prepare',
    when: ({ state }) => state.machineType === undefined,
    then: () =>
      decided(
        'prepare.machine-type',
        'prepare',
        'ask_user',
        {
          question: 'What kind of machine is it?',
          answers: [...MACHINE_TYPE_ANSWERS],
          sequence: 'Question 1 of 3',
          detail: 'Pick one, or answer “Don’t know” if you’re not sure.',
        },
        {
          text: 'Hi. I’ll take this one step at a time and tell you why before each one. First, a few quick questions — answer “Don’t know” to any you’re not sure about.',
        },
      ),
  },
  {
    id: 'prepare.brand',
    stage: 'prepare',
    when: ({ state }) => state.brand === undefined,
    then: ({ state, kb }) =>
      decided('prepare.brand', 'prepare', 'ask_user', {
        question: 'Is there a brand on it?',
        answers: kb.brandSuggestions(state.machineType ?? null),
        allowFreeText: true,
        sequence: 'Question 2 of 3',
        detail: 'Pick one, or type your own answer below.',
      }),
  },
  {
    id: 'prepare.power-on',
    stage: 'prepare',
    when: ({ state }) => !state.poweredOn,
    then: () =>
      decided('prepare.power-on', 'prepare', 'request_action', {
        instruction:
          'Switch it on, then disconnect anything else that might be connected to it — the gym’s app, a phone, a watch.',
        needsReady: false,
        sequence: 'Question 3 of 3',
        why: 'Most machines talk to one device at a time. If something else holds the connection, I won’t see it.',
      }),
  },
];
