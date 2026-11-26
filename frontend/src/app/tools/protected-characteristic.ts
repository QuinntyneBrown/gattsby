import type { ProtectedGattError } from '../ble/protected-gatt-error';
import { shortUuid } from '../knowledge-base/uuid';
import type { Observation } from '../store/model/observation';
import type { ToolContext } from './tool-context';

const PROTECTED = 'protected-characteristic';

export function isProtected(observations: readonly Observation[], uuid: string): boolean {
  return observations.some((entry) => entry.kind === PROTECTED && entry.subject === uuid);
}

export function recordProtected(ctx: ToolContext, error: ProtectedGattError): readonly string[] {
  const name = ctx.kb.nameOf(error.uuid) ?? `characteristic ${shortUuid(error.uuid)}`;
  const observation = ctx.observe({
    kind: PROTECTED,
    subject: error.uuid,
    value: 'AUTH_REQUIRED',
    text: `${name} requires authentication or encryption.`,
    tag: 'confirmed',
    evidence: error.evidence,
  });
  const request = ctx.raiseMissingTool({
    capabilityKey: `protected-characteristic:${error.uuid}`,
    title: `Read the protected ${name}`,
    reason: 'The device requires authentication or encryption for this characteristic.',
    evidence: [observation, ...error.evidence],
    source: 'encrypted',
  });
  return [observation, request, ...error.evidence];
}
