import type { ScriptedCharacteristic } from './scripted-characteristic';

export interface ScriptedService {
  readonly uuid: number | string;
  readonly characteristics: readonly ScriptedCharacteristic[];
}
