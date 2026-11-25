import validate from '../../schemas/generated/device-profile-1.js';
import type { DecisionState } from '../agent/decision-state';
import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import { canonicalUuid } from '../knowledge-base/uuid';
import type { DeviceProfile } from '../store/model/device-profile';
import type { Hypothesis } from '../store/model/hypothesis';
import type { Investigation } from '../store/model/investigation';
import type { MissingToolRequest } from '../store/model/missing-tool-request';
import type { Observation } from '../store/model/observation';
import type { RawLogEntry } from '../store/model/raw-log-entry';
import type { Step } from '../store/model/step';
import type { Verdict } from '../store/model/verdict';
import { ToolDefect } from '../agent/tool-executor';
import { claimedFeatures } from './profile-features';

export function buildProfile(
  investigation: Investigation,
  verdict: Verdict,
  state: DecisionState,
  kb: KnowledgeBaseIndex,
  hypothesis: Hypothesis | null,
  observations: readonly Observation[],
  steps: readonly Step[],
  requests: readonly MissingToolRequest[],
  rawEvidence: readonly RawLogEntry[],
  packets: number,
): DeviceProfile {
  const evidenceIds = new Set([...steps, ...observations, ...rawEvidence].map((row) => row.id));
  const retainEvidence = (ids: readonly string[]) => [
    ...new Set(ids.filter((id) => evidenceIds.has(id))),
  ];
  const undetermined: DeviceProfile['undetermined'][number][] = [];
  const quirks: DeviceProfile['quirks'][number][] = [];
  const metrics = state.readableMetrics.flatMap((metric): DeviceProfile['metrics'][number][] => {
    const evidence = retainEvidence(metric.evidence);
    if (!evidence.length) {
      undetermined.push({ subject: clip(metric.label), reason: 'No evidence recorded.' });
      return [];
    }
    for (const text of metric.quirks) quirks.push({ text, evidence });
    const { rule, quirks: _quirks, characteristic, rateHz, status, ...fields } = metric;
    void _quirks;
    return [
      {
        ...fields,
        characteristic: canonicalUuid(characteristic),
        rule:
          rule.kind === 'offset'
            ? { kind: rule.kind, offset: rule.from, length: rule.to - rule.from + 1 }
            : { kind: rule.kind, flagBit: rule.bit },
        endianness: 'little',
        ...(rateHz === undefined ? {} : { rateHz }),
        status: status === 'claimedOnly' ? 'likely' : status,
        evidence,
      },
    ];
  });
  const advertisedName = state.device?.name ?? investigation.deviceName;
  const deviceInfo = state.deviceInfo === 'absent' ? null : state.deviceInfo;
  const service = kb.services.find((entry) => entry.shortName === hypothesis?.protocol);
  const features = claimedFeatures(state, steps, observations);
  const profile: DeviceProfile = {
    kind: 'gattsby.device-profile',
    formatVersion: '1.0',
    kbVersion: investigation.kbVersion,
    id: `p-${investigation.id.slice(2)}`,
    investigationId: investigation.id,
    createdAt: new Date(verdict.issuedAt).toISOString(),
    identity: {
      displayName: clip(advertisedName || deviceInfo?.model || 'Unnamed device'),
      advertisedName: optionalText(advertisedName),
      deviceType: optionalText(hypothesis?.deviceType ?? state.machineType),
      maker: optionalText(deviceInfo?.manufacturer ?? hypothesis?.maker),
      model: optionalText(deviceInfo?.model ?? hypothesis?.model),
      firmware: optionalText(deviceInfo?.firmware),
      evidence: retainEvidence(
        steps
          .filter(
            (step) => step.result.ok && ['scan_devices', 'read_device_info'].includes(step.tool),
          )
          .map((step) => step.id),
      ),
    },
    services: {
      advertised: uniqueUuids(state.device?.advertisedServices ?? []),
      discovered: uniqueUuids(state.layout?.map((entry) => entry.uuid) ?? []),
      unreachable: [
        ...uniqueUuids(state.unreachable).map((uuid) => ({ uuid, reason: 'unreachable' })),
        ...(state.layout ? [{ uuid: null, reason: 'outsideKnownList' }] : []),
      ],
    },
    protocol: hypothesis
      ? {
          name: clip(hypothesis.protocol),
          variant: clip(hypothesis.label),
          service: service?.uuid ?? null,
          confidence: hypothesis.confidence,
          hypothesisVersion: hypothesis.version,
        }
      : null,
    metrics,
    features,
    handshake: null,
    quirks,
    undetermined,
    verdict: {
      kind: verdict.kind,
      label: clip(verdict.label, 280),
      protocol: optionalText(verdict.protocol),
      summary: clip(verdict.summary, 280),
    },
    missingToolRequests: requests.map((request) => request.id),
    counts: { steps: verdict.stepN, packets, approvedCommands: 0 },
  };
  if (!validate(profile)) throw new ToolDefect('finish', 'The device profile did not validate.');
  return profile;
}

function clip(value: string, limit = 120): string {
  return Array.from(value).slice(0, limit).join('');
}

function optionalText(value: string | null | undefined): string | null {
  return value ? clip(value) : null;
}

function uniqueUuids(uuids: readonly string[]): string[] {
  return [...new Set(uuids.map(canonicalUuid))];
}
