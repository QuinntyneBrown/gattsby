import type { DeviceInformation } from '../agent/device-information';
import type { ProfileCandidate } from '../agent/profile-candidate';
import type { GattServiceInfo } from '../ble/gatt-layout';
import type { KnowledgeBaseIndex } from './knowledge-base-index';
import { shortUuid } from './uuid';

// The facts scored (match-known-profiles design, scoring rule 1).
export interface DeviceFacts {
  readonly layout: readonly GattServiceInfo[];
  readonly name: string | null;
  readonly deviceInfo: DeviceInformation | null;
}

const REQUIRED = 60;
const EXPECTED_EACH = 10;
const EXPECTED_MAX = 20;
const SERVICE = 15;
const VENDOR = 5;

// Scores every knowledge-base profile from 0 to 100 (TOOL-012). Deterministic: candidates sort by
// score, then by profile ID; no clock, random value or map order enters the result.
export function matchProfiles(kb: KnowledgeBaseIndex, facts: DeviceFacts): ProfileCandidate[] {
  const characteristics = new Set(
    facts.layout.flatMap((s) => s.characteristics.map((c) => c.uuid)),
  );
  const services = new Set(facts.layout.map((s) => s.uuid));
  const vendorAgrees = kb.vendors.some((v) =>
    v.namePatterns.some(
      (p) =>
        (facts.name !== null && new RegExp(p.pattern, 'u').test(facts.name)) ||
        (facts.deviceInfo?.manufacturer ?? '').toLowerCase() === v.brand.toLowerCase(),
    ),
  );
  return kb
    .profiles()
    .map((profile): ProfileCandidate => {
      const matched: string[] = [];
      const missing: string[] = [];
      const fact = (uuid: string) => `${kb.nameOf(uuid) ?? 'Characteristic'} (${shortUuid(uuid)})`;
      let score = 0;
      if (services.has(profile.service.uuid)) {
        score += SERVICE;
        matched.push(`${profile.service.name} service (${shortUuid(profile.service.uuid)})`);
      } else {
        missing.push(`${profile.service.name} service (${shortUuid(profile.service.uuid)})`);
      }
      const required = profile.requires.every((uuid) => characteristics.has(uuid));
      for (const uuid of profile.requires)
        (characteristics.has(uuid) ? matched : missing).push(fact(uuid));
      if (required) score += REQUIRED;
      let expected = 0;
      for (const uuid of profile.expects) {
        if (characteristics.has(uuid)) {
          expected += EXPECTED_EACH;
          matched.push(fact(uuid));
        } else {
          missing.push(fact(uuid));
        }
      }
      score += Math.min(expected, EXPECTED_MAX);
      if (required && vendorAgrees) score += VENDOR;
      return {
        profileId: profile.id,
        label: profile.label,
        protocol: profile.service.shortName,
        serviceUuid: profile.service.uuid,
        deviceType: profile.deviceType,
        score: Math.min(score, 100),
        matched,
        missing,
      };
    })
    .sort((a, b) => b.score - a.score || (a.profileId < b.profileId ? -1 : 1));
}

export type MatchDecision =
  | { readonly kind: 'decided'; readonly candidate: ProfileCandidate }
  | { readonly kind: 'ambiguous'; readonly candidates: readonly ProfileCandidate[] };

/**
 * Decided when the best protocol scores at least the threshold and more than `margin` points ahead
 * of the best candidate of any other protocol (FR-021; match-known-profiles decision rules).
 */
export function decide(
  candidates: readonly ProfileCandidate[],
  threshold: number,
  margin: number,
): MatchDecision {
  const best = candidates[0];
  if (!best || best.score < threshold) return { kind: 'ambiguous', candidates };
  const rival = candidates.find((c) => c.serviceUuid !== best.serviceUuid);
  if (rival && best.score - rival.score <= margin) return { kind: 'ambiguous', candidates };
  return { kind: 'decided', candidate: best };
}
