import { canonicalJson } from './canonical-json';
import type { DeviceProfile } from './model/device-profile';

export function sameDeviceProfile(a: DeviceProfile, b: DeviceProfile): boolean {
  const body = (profile: DeviceProfile) =>
    Object.fromEntries(
      Object.entries(profile).filter(
        ([key]) => !['exportedAt', 'appVersion', 'notes'].includes(key),
      ),
    );
  return canonicalJson(body(a)) === canonicalJson(body(b));
}
