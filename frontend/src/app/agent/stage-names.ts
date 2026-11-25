import type { Stage } from '../store/model/stage';

export const STAGE_NAMES: Readonly<Record<Stage, string>> = {
  prepare: 'Prepare',
  find: 'Find',
  identify: 'Identify',
  standard: 'Standard path',
  proprietary: 'Proprietary path',
  control: 'Control',
  conclude: 'Conclude',
};
