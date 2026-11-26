import { toHex } from '../ble/hex-codec';
import { CHECKSUMS } from './checksums';
import type { FramingReport } from './framing-report';
import { readInteger } from './read-integer';
import { sequenceCounter } from './sequence-counter';

export const MIN_FRAMING_PACKETS = 20;
const THRESHOLD = 0.9;
const RELATIONS = ['total', 'afterHeader', 'afterLength'] as const;

export function detectFraming(packets: readonly Uint8Array[]): FramingReport | null {
  if (packets.length < MIN_FRAMING_PACKETS) return null;
  const shortest = Math.min(...packets.map(({ length }) => length));
  const prefix = headerBytes(packets, shortest);
  const header = prefix.length
    ? {
        offset: 0 as const,
        bytes: toHex(prefix),
        share: fit(packets, (packet) => prefix.every((value, index) => packet[index] === value)),
      }
    : undefined;
  const length = lengthField(packets, prefix.length, shortest);
  const checksum = checksumField(packets, prefix.length, length?.offset);
  const counter = counterField(packets, prefix.length, shortest, length?.offset, checksum?.offset);
  const algorithm = CHECKSUMS.find(({ name }) => name === checksum?.algorithm);
  const packetFit =
    header || length || checksum
      ? fit(
          packets,
          (packet) =>
            prefix.every((value, index) => packet[index] === value) &&
            (!length ||
              packet[length.offset] ===
                lengthValue(length.relation, packet.length, prefix.length, length.offset)) &&
            (!checksum ||
              !algorithm ||
              matchesChecksum(packet, algorithm, checksum.range[0], checksum.byteOrder ?? 'LE')),
        )
      : 0;
  return { header, length, checksum, counter, fit: packetFit, packets: packets.length };
}

function fit(packets: readonly Uint8Array[], matches: (packet: Uint8Array) => boolean): number {
  return packets.filter(matches).length / packets.length;
}

function headerBytes(packets: readonly Uint8Array[], shortest: number): number[] {
  const prefix: number[] = [];
  for (let offset = 0; offset < shortest - 1; offset++) {
    // Leave a byte that looks like a length field for the length detector.
    if (
      RELATIONS.some(
        (relation) =>
          fit(
            packets,
            (packet) =>
              packet[offset] === lengthValue(relation, packet.length, prefix.length, offset),
          ) >= THRESHOLD,
      )
    )
      break;
    const counts = new Map<number, number>();
    for (const packet of packets) {
      const value = packet[offset];
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const common = [...counts].find(([, count]) => count / packets.length >= THRESHOLD);
    if (!common) break;
    const candidate = [...prefix, common[0]];
    if (
      fit(packets, (packet) => candidate.every((value, index) => packet[index] === value)) <
      THRESHOLD
    )
      break;
    prefix.push(common[0]);
  }
  return prefix;
}

function lengthValue(
  relation: (typeof RELATIONS)[number],
  size: number,
  header: number,
  offset: number,
): number {
  if (relation === 'total') return size;
  if (relation === 'afterHeader') return size - header;
  return size - offset - 1;
}

function lengthField(packets: readonly Uint8Array[], header: number, shortest: number) {
  let best: FramingReport['length'];
  const ambiguous = packets.every((packet) => packet.length === shortest);
  for (const relation of RELATIONS) {
    for (let offset = header; offset < Math.min(shortest - 1, header + 4); offset++) {
      const share = fit(
        packets,
        (packet) => packet[offset] === lengthValue(relation, packet.length, header, offset),
      );
      if (share >= THRESHOLD && (!best || share > best.share))
        best = { offset, relation, includesHeader: relation === 'total', share, ambiguous };
    }
  }
  return best;
}

function checksumField(packets: readonly Uint8Array[], header: number, lengthOffset?: number) {
  let best: FramingReport['checksum'];
  const starts = new Set([0, header, ...(lengthOffset === undefined ? [] : [lengthOffset + 1])]);
  for (const algorithm of CHECKSUMS) {
    for (const start of starts) {
      if (!variedContent(packets, start, algorithm.width)) continue;
      for (const order of algorithm.width === 1 ? (['LE'] as const) : (['LE', 'BE'] as const)) {
        const share = fit(packets, (packet) => matchesChecksum(packet, algorithm, start, order));
        if (share < THRESHOLD || (best && share <= best.share)) continue;
        best = {
          offset: algorithm.width === 1 ? -1 : -2,
          algorithm: algorithm.name,
          range: [start, -algorithm.width - 1],
          ...(algorithm.width === 2 && { byteOrder: order }),
          share,
        };
      }
    }
  }
  return best;
}

function variedContent(packets: readonly Uint8Array[], start: number, width: number): boolean {
  const first = packets[0].subarray(start, -width);
  return packets.some((packet) => {
    const body = packet.subarray(start, -width);
    return first.length !== body.length || first.some((byte, index) => byte !== body[index]);
  });
}

function matchesChecksum(
  packet: Uint8Array,
  algorithm: (typeof CHECKSUMS)[number],
  start: number,
  order: 'LE' | 'BE',
): boolean {
  const offset = packet.length - algorithm.width;
  return (
    offset > start &&
    algorithm.calculate(packet.subarray(start, offset)) ===
      readInteger(packet, offset, algorithm.width, order, false)
  );
}

function counterField(
  packets: readonly Uint8Array[],
  header: number,
  shortest: number,
  lengthOffset?: number,
  checksumOffset?: number,
) {
  let best: FramingReport['counter'];
  for (let offset = header; offset < shortest + (checksumOffset ?? 0); offset++) {
    if (offset === lengthOffset) continue;
    const candidate = sequenceCounter(packets.map((packet) => packet[offset]));
    if (candidate && (!best || candidate.share > best.share)) best = { offset, ...candidate };
  }
  return best;
}
