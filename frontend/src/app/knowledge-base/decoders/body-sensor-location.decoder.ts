import { DecodeError, type Decoder } from './decoder';

const LOCATIONS = ['Other', 'Chest', 'Wrist', 'Finger', 'Hand', 'Ear lobe', 'Foot'];

/** Body Sensor Location (0x2A38): one byte naming where the sensor is worn. */
export const bodySensorLocationDecoder: Decoder = {
  id: 'body-sensor-location',
  decode(bytes) {
    if (bytes.length < 1) throw new DecodeError('Body Sensor Location needs one byte.');
    const location = LOCATIONS[bytes[0]] ?? `Reserved (${bytes[0]})`;
    return { text: location, value: { location } };
  },
};
