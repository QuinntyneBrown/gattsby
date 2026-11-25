import { describe, expect, it } from 'vitest';
import { batteryLevelDecoder } from './battery-level.decoder';
import { bodySensorLocationDecoder } from './body-sensor-location.decoder';
import { DecodeError } from './decoder';
import { fitnessMachineFeatureDecoder } from './fitness-machine-feature.decoder';
import { supportedSpeedRangeDecoder } from './supported-speed-range.decoder';
import { utf8StringDecoder } from './utf8-string.decoder';

const bytes = (...values: number[]) => Uint8Array.from(values);

describe('decoders', () => {
  it('reads Battery Level 0x5A as 90 % (TOOL-011 AC1)', () => {
    expect(batteryLevelDecoder.decode(bytes(0x5a)).text).toBe('90 %');
  });

  it('refuses a Battery Level above 100', () => {
    expect(() => batteryLevelDecoder.decode(bytes(101))).toThrow(DecodeError);
  });

  it('reads Body Sensor Location 1 as Chest', () => {
    expect(bodySensorLocationDecoder.decode(bytes(1)).text).toBe('Chest');
  });

  it('trims trailing NUL bytes and spaces from Device Information text', () => {
    expect(utf8StringDecoder.decode(bytes(0x54, 0x32, 0x30, 0x32, 0x20, 0x00, 0x00)).text).toBe(
      'T202',
    );
  });

  it('keeps markup in device text as characters', () => {
    const text = [...'<b>Bike</b>'].map((c) => c.charCodeAt(0));
    expect(utf8StringDecoder.decode(Uint8Array.from(text)).text).toBe('<b>Bike</b>');
  });

  // Fitness Machine Service 1.0, section 4.3: features 0x0000140C are total distance,
  // inclination, heart rate and elapsed time; targets 0x00000003 are speed and inclination.
  it('reads the Fitness Machine Feature bits', () => {
    const { value } = fitnessMachineFeatureDecoder.decode(
      bytes(0x0c, 0x14, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00),
    );
    expect(value).toEqual({
      features: ['Total distance', 'Inclination', 'Heart rate', 'Elapsed time'],
      targets: ['Speed', 'Inclination'],
    });
  });

  it('refuses a Fitness Machine Feature that is not 8 bytes', () => {
    expect(() => fitnessMachineFeatureDecoder.decode(bytes(1, 2, 3))).toThrow(DecodeError);
  });

  // Section 4.12: minimum 0.80, maximum 16.00 and increment 0.10 km/h, uint16 in 0.01 km/h.
  it('reads the Supported Speed Range', () => {
    expect(supportedSpeedRangeDecoder.decode(bytes(80, 0, 0x40, 0x06, 10, 0)).text).toBe(
      'Speed 0.8–16.0 km/h by 0.1',
    );
  });
});
