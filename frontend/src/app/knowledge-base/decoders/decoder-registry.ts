import { batteryLevelDecoder } from './battery-level.decoder';
import { bodySensorLocationDecoder } from './body-sensor-location.decoder';
import type { Decoder } from './decoder';
import { fitnessMachineFeatureDecoder } from './fitness-machine-feature.decoder';
import { hexDecoder } from './hex.decoder';
import { supportedSpeedRangeDecoder } from './supported-speed-range.decoder';
import { utf8StringDecoder } from './utf8-string.decoder';

// Every decoder by ID. Its IDs are the ones in decoder-ids.json, which the build checks every
// knowledge-base file against.
export const DECODERS: ReadonlyMap<string, Decoder> = new Map(
  [
    utf8StringDecoder,
    hexDecoder,
    batteryLevelDecoder,
    bodySensorLocationDecoder,
    fitnessMachineFeatureDecoder,
    supportedSpeedRangeDecoder,
  ].map((decoder) => [decoder.id, decoder]),
);
