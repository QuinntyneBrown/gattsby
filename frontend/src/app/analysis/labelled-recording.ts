import type { PacketSample } from './packet-sample';

export interface LabelledRecording {
  readonly id: string;
  readonly label: string;
  readonly characteristics: readonly string[];
  readonly packets: readonly PacketSample[];
}
