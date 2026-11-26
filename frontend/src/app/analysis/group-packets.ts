import type { LabelledRecording } from './labelled-recording';
import type { PacketSample } from './packet-sample';

export function groupPackets(recordings: readonly LabelledRecording[]) {
  const groups = new Map<
    string,
    {
      uuid: string;
      length: number;
      recordings: Map<string, PacketSample[]>;
    }
  >();
  for (const { id, packets } of recordings) {
    for (const packet of packets) {
      const uuid = packet.uuid;
      const length = packet.bytes.length;
      const key = `${uuid}/${length}`;
      const group = groups.get(key) ?? { uuid, length, recordings: new Map() };
      const matching = group.recordings.get(id) ?? [];
      matching.push(packet);
      group.recordings.set(id, matching);
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}
