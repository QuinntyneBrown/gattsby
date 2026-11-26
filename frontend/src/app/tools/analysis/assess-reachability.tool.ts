import type { ReachabilityAssessment } from '../../analysis/reachability-assessment';
import { REACHABILITY_CHECKS } from '../../analysis/reachability-checks';
import { entry } from '../tool-definition';
import { fail, ok } from '../tool-result';

export const assessReachabilityTool = entry<Record<string, never>, ReachabilityAssessment>({
  name: 'assess_reachability',
  group: 'Analysis',
  description: 'Assess Bluetooth Low Energy reachability from the scans and the person’s answers.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
  safetyClass: 'read',
  modelSelectable: false,
  preconditions: [],
  stages: ['find', 'conclude'],
  requiredCapabilities: [],
  phase: 'MVP',
  labels: {
    running: () => 'Checking whether Chrome can reach the device',
    purpose: () => 'Assess Bluetooth Low Energy reachability',
    card: true,
  },
  async run(_input, ctx) {
    if (ctx.state.scans.length === 0)
      return fail('PRECONDITION_FAILED', 'Run a scan before assessing reachability.');
    const { assessReachability } = await import('../../analysis/reachability-assessor');
    const observations = ctx.verdictFacts().observations;
    const scanCount = ctx.state.scans.filter(({ outcome }) => outcome === 'cancelled').length;
    const assessment = assessReachability({
      chosen: !!ctx.state.device,
      connected: ctx.state.everConnected,
      refusedConnections: observations.filter(({ kind }) => kind === 'held-by-other').length,
      unrecognisedScans: scanCount,
      checks: ctx.state.reachabilityChecks,
    });
    const checkQuestions = new Set<string>(
      REACHABILITY_CHECKS.flatMap(({ title, remedy }) => (remedy ? [title, remedy] : [title])),
    );
    const evidence = [
      ...new Set(
        observations
          .filter(
            ({ kind, subject }) =>
              kind === 'scan-cancelled' ||
              kind === 'scan-failed' ||
              kind === 'held-by-other' ||
              checkQuestions.has(subject),
          )
          .flatMap(({ id, evidence }) => [id, ...evidence]),
      ),
    ];
    const heldByOther = assessment.likelyCauses.includes('held by another central');
    const observed =
      assessment.reachable === 'yes'
        ? 'The device appeared in Chrome'
        : assessment.reachable === 'unknown'
          ? 'The checks did not establish why Chrome could not reach the device'
          : heldByOther
            ? 'Another app or watch may be holding the connection'
            : `Device not recognised in ${scanCount} Bluetooth Low Energy scans`;
    const id = ctx.observe({
      kind: 'reachability',
      subject: 'bluetooth-low-energy',
      value: assessment.reachable,
      text: `Reachability: ${observed}.`,
      tag: assessment.reachable === 'unknown' ? 'guess' : heldByOther ? 'likely' : 'confirmed',
      evidence,
    });
    if (assessment.reachable === 'unknown') {
      ctx.raiseMissingTool({
        capabilityKey: 'verify-bluetooth-reachability',
        title: 'Verify Bluetooth Low Energy reachability',
        reason: 'The scans and checks could not establish why Chrome could not reach the device.',
        evidence: [id, ...evidence],
      });
    }
    return ok(`${observed}.`, assessment, [id, ...evidence]);
  },
});
