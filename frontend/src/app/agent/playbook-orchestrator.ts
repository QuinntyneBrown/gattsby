import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BleLayer } from '../ble/ble-layer';
import { ApprovalLedger } from '../ble/approval-ledger';
import { RawTrafficLog } from '../ble/raw-traffic-log';
import type { Capabilities } from '../environment/capabilities';
import { CapabilityDetector } from '../environment/capability-detector';
import { KnowledgeBase } from '../knowledge-base/knowledge-base';
import { hasFtmsControlPoint } from '../knowledge-base/ftms-control-point';
import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import type { ModelSession } from '../model/model-session';
import { ModelSessions } from '../model/model-sessions';
import { HypothesisTracker } from '../outcome/hypothesis-tracker';
import { buildProfile } from '../outcome/profile-builder';
import { verdictLabel, type VerdictFacts } from '../outcome/verdict-builder';
import { Clock } from '../shared/clock';
import { InvestigationStore } from '../store/investigation-store';
import { PendingVerdict } from '../store/pending-verdict';
import { StoreError } from '../store/store-error';
import type { ApprovalDecision } from '../store/model/approval-decision';
import type { EmergencyStopEvent } from '../store/model/emergency-stop-event';
import type { Hypothesis } from '../store/model/hypothesis';
import type { Investigation } from '../store/model/investigation';
import type { MissingToolRequest } from '../store/model/missing-tool-request';
import type { ModeChange } from '../store/model/mode-change';
import type { ModelDecision } from '../store/model/model-decision';
import type { Observation } from '../store/model/observation';
import type { Recording } from '../store/model/recording';
import { STAGES, type Stage } from '../store/model/stage';
import type { Step, StepPersonExchange } from '../store/model/step';
import type { StopReason } from '../store/model/stop-reason';
import type { Verdict, VerdictKind } from '../store/model/verdict';
import type { VerdictCommit } from '../store/model/verdict-commit';
import { TOOL_CATALOG } from '../tools/tool-catalog';
import { ControlPointExchange } from '../tools/control/control-point-exchange';
import { NotificationRecorder } from '../tools/listening/notification-recorder';
import type { UpdateHypothesisInput } from '../tools/meta/update-hypothesis.tool';
import type { NewMissingToolRequest, ToolContext } from '../tools/tool-context';
import { ToolError } from '../tools/tool-error';
import { ToolRegistry } from '../tools/tool-registry';
import { fail, type ToolResult } from '../tools/tool-result';
import { applyStep, stateFrom, type DecisionState } from './decision-state';
import { ApprovalGate } from './approval-gate';
import { ConfirmationCheck } from './confirmation-check';
import { ControlTelemetry } from './control-telemetry';
import { EmergencyStopController } from './emergency-stop-controller';
import { ChecklistDecider } from './checklist-decider';
import { buildFeed } from './feed-builder';
import type { FeedEntry } from './feed-entry';
import { LOOP_CONFIG } from './loop-config';
import type { ModelDecider } from './model-decider';
import { ModelFailureRun } from './model-failure-run';
import { checklistOptions, isBuiltStage, nextOutcome } from './playbook-rules';
import { PromptChannel } from './prompt-channel';
import type { RuleAction } from './rule-outcome';
import { STAGE_NAMES } from './stage-names';
import { checkStop } from './stop-conditions';
import { executeTool, ToolDefect } from './tool-executor';
import { validateToolAction } from './validate-tool-action';

export type OrchestratorStatus =
  'loading' | 'running' | 'paused' | 'concluding' | 'concluded' | 'error';

export type StageState = 'done' | 'now' | 'to do' | 'skipped';

interface PendingStep {
  readonly action: RuleAction;
  readonly label: string;
  readonly detail: string | null;
  readonly card: boolean;
}

const MAX_REFUSED_FINISHES = 2;
const RUNNING_DETAIL = 'Read-only, takes about a second. Nothing for you to do.';

// Runs the playbook: observe → decide → act, one step at a time (apply-heuristics-first,
// end-the-loop and follow-the-investigation designs). The deterministic rules decide every step
// they can; an ambiguous one goes to the `Decider`. Each step is committed to the store with what
// it produced before the next one starts (FR-060). Provided by the Investigation page, so leaving
// the page releases it.
@Injectable()
export class PlaybookOrchestrator {
  private readonly store = inject(InvestigationStore);
  private readonly pendingVerdict = inject(PendingVerdict);
  private readonly knowledgeBase = inject(KnowledgeBase);
  private readonly ble = inject(BleLayer);
  private readonly approvalLedger = inject(ApprovalLedger);
  readonly approvalGate = inject(ApprovalGate);
  private readonly controlPoint = inject(ControlPointExchange);
  private readonly controlTelemetry = inject(ControlTelemetry);
  readonly emergencyStop = inject(EmergencyStopController);
  private readonly notificationRecorder = inject(NotificationRecorder);
  private readonly confirmationCheck = inject(ConfirmationCheck);
  private readonly log = inject(RawTrafficLog);
  private readonly capabilities = inject(CapabilityDetector);
  private readonly clock = inject(Clock);
  private readonly config = inject(LOOP_CONFIG);
  private readonly checklistDecider = inject(ChecklistDecider);
  private modelDecider: ModelDecider | null = null;
  private readonly modelSessions = inject(ModelSessions);
  private readonly router = inject(Router);
  readonly prompts = inject(PromptChannel);
  readonly registry = new ToolRegistry(TOOL_CATALOG);

  private readonly kbSignal = signal<KnowledgeBaseIndex | null>(null);
  private tracker: HypothesisTracker | null = null;
  private modelSession: ModelSession | null = null;
  private abort = new AbortController();
  private leaving = false;
  private stopReason: StopReason | null = null;
  private concludeNow = false;
  private emergencyTask: Promise<EmergencyStopEvent> | null = null;
  private emergencyEvent: EmergencyStopEvent | null = null;
  private observationCounter = 0;
  private requestCounter = 0;
  private readonly observationKeys = new Set<string>();
  private noProgressRun = 0;
  private modelConsultations = 0;
  private readonly modelFailures = new ModelFailureRun();
  private refusedFinishes = 0;

  private readonly investigationSignal = signal<Investigation | null>(null);
  private readonly steps = signal<readonly Step[]>([]);
  private readonly observations = signal<readonly Observation[]>([]);
  readonly confirmedMetrics = computed(
    () =>
      new Set(
        this.observations()
          .filter((evidence) => evidence.kind === 'metric-confirmed')
          .map((evidence) => evidence.subject),
      ),
  );
  private readonly requests = signal<readonly MissingToolRequest[]>([]);
  private readonly hypotheses = signal<readonly Hypothesis[]>([]);
  private readonly pending = signal<PendingStep | null>(null);
  private readonly statusSignal = signal<OrchestratorStatus>('loading');
  private readonly errorSignal = signal<string | null>(null);
  private readonly modelThinkingSignal = signal(false);
  private readonly choosingStage = signal<Stage | null>(null);
  readonly modelThinking = this.modelThinkingSignal.asReadonly();

  readonly investigation = this.investigationSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly connection = this.ble.connection;
  readonly state = computed<DecisionState>(() => stateFrom(this.steps()));
  readonly stage = computed<Stage>(
    () => this.pending()?.action.stage ?? this.choosingStage() ?? this.state().stage,
  );
  readonly mode = computed(() => this.investigationSignal()?.mode ?? 'agent');
  readonly modeChange = computed(() => this.investigationSignal()?.modeChanges?.at(-1) ?? null);
  readonly hypothesis = computed(() => this.hypotheses().at(-1) ?? null);
  readonly missingToolRequests = this.requests.asReadonly();

  readonly stageStates = computed(() => {
    const current = STAGES.indexOf(this.stage());
    return STAGES.map((stage, index) => ({
      stage,
      name: STAGE_NAMES[stage],
      state: (index < current
        ? isBuiltStage(stage) || stage === 'conclude'
          ? 'done'
          : 'skipped'
        : index === current
          ? 'now'
          : 'to do') as StageState,
    }));
  });

  /** What runs now, for the dock when no prompt is open. */
  readonly running = computed(() => {
    const pending = this.pending();
    return pending && pending.card
      ? { label: pending.label, detail: pending.detail ?? RUNNING_DETAIL }
      : null;
  });

  readonly feed = computed<FeedEntry[]>(() => {
    const kb = this.kbSignal();
    if (!kb) return [];
    const speaker = this.mode() === 'checklist' ? 'checklist' : 'agent';
    const committed = buildFeed(
      this.steps(),
      this.observations(),
      this.hypotheses(),
      this.registry,
      kb,
      speaker,
    );
    const pending = this.pending();
    if (!pending) return committed;
    const lastStage = this.steps().at(-1)?.stage ?? null;
    const extra: FeedEntry[] = [];
    if (pending.action.stage !== lastStage) {
      extra.push({
        kind: 'stageStart',
        id: 'pending-stage',
        stage: pending.action.stage,
        title: STAGE_NAMES[pending.action.stage],
      });
    }
    if (pending.action.message) {
      extra.push({
        kind: 'message',
        id: 'pending-say',
        speaker,
        text: pending.action.message.text,
        why: pending.action.message.why ?? null,
      });
    }
    const ask = askOf(pending.action);
    if (ask)
      extra.push({ kind: 'message', id: 'pending-ask', speaker, text: ask.text, why: ask.why });
    if (pending.card) {
      extra.push({
        kind: 'tool',
        id: 'pending-tool',
        tool: pending.action.tool,
        purpose: pending.label,
        durationMs: null,
        summary: null,
        failed: false,
        running: true,
        observations: [],
      });
    }
    return [...committed, ...extra];
  });

  /** Loads the investigation and runs it, or shows it as it was left (FR-060). */
  async open(id: string): Promise<void> {
    await this.load(id).catch((error: unknown) => this.fault(error));
  }

  private async load(id: string): Promise<void> {
    this.kbSignal.set(await this.knowledgeBase.load());
    let record = await this.store.get(id);
    this.tracker = new HypothesisTracker(id);
    this.tracker.restore(record.hypotheses);
    if (
      !record.investigation.verdict &&
      record.steps.length > 0 &&
      record.investigation.status === 'running'
    ) {
      await this.store.recover(id);
      record = await this.store.get(id);
    }
    this.investigationSignal.set(record.investigation);
    this.steps.set(record.steps);
    this.observations.set(record.observations);
    this.hypotheses.set(record.hypotheses);
    this.requests.set(record.missingToolRequests);
    this.observationCounter = record.observations.length;
    this.requestCounter = record.missingToolRequests.length;
    this.modelConsultations = record.investigation.modelConsultations;
    record.observations.forEach((o) => this.observationKeys.add(keyOf(o)));
    if (record.investigation.verdict) {
      this.statusSignal.set('concluded');
      return;
    }
    if (record.investigation.status !== 'running') {
      this.statusSignal.set('paused');
      return;
    }
    this.modelSession = this.modelSessions.take(id);
    this.approvalLedger.begin();
    if (record.investigation.emergencyStoppedAt !== undefined) this.approvalLedger.lock();
    this.statusSignal.set('running');
    this.log.begin(id, 0);
    await this.loop();
  }

  /** Stops the loop at once (personStop or emergencyStop) and concludes with what is known. */
  stop(reason: 'personStop' | 'emergencyStop'): void {
    if (this.statusSignal() !== 'running' || this.stopReason === 'emergencyStop') return;
    this.stopReason = reason;
    this.concludeNow = true;
    this.abort.abort();
    this.prompts.cancel();
    if (reason === 'emergencyStop') {
      const event = { tappedAt: this.clock.now(), mode: this.mode(), stage: this.stage() };
      this.emergencyTask = this.emergencyStop.trigger(
        event,
        this.kbSignal()!,
        hasFtmsControlPoint(this.state().layout),
      );
      const id = this.investigationSignal()!.id;
      void this.store.latchEmergencyStop(id, event.tappedAt).catch(() => undefined);
    }
  }

  /** Leaving the page: releases the connection and the memory (FR-018, NFR-005). */
  async leave(): Promise<void> {
    this.leaving = true;
    this.emergencyStop.leave();
    this.approvalLedger.lock();
    this.abort.abort();
    this.prompts.cancel();
    this.releaseModel();
    this.log.clear();
    await this.ble.disconnect();
  }

  private async loop(): Promise<void> {
    const id = this.investigationSignal()!.id;
    while (!this.leaving && this.statusSignal() === 'running') {
      if (this.emergencyTask) {
        this.emergencyEvent = await this.emergencyTask;
        this.emergencyTask = null;
        if (this.leaving) return;
        this.resetSignalAfterStop();
      }
      const context = this.ruleContext();
      const outcome = nextOutcome(context, this.concludeNow);
      if (!outcome) break;
      let action: RuleAction;
      let modelDecision: ModelDecision | undefined;
      let refusal: ToolError | undefined;
      let chosenByPerson = false;
      const caps = this.steps().find((step) => step.tool === 'check_capabilities')?.result;
      const options =
        this.mode() === 'checklist' && !this.concludeNow ? checklistOptions(outcome, context) : [];
      if (options.length) {
        const stage = outcome.kind === 'ambiguous' ? outcome.stage : outcome.action.stage;
        this.choosingStage.set(stage);
        const chosen = await this.checklistDecider.decide(
          options,
          (choice) => {
            if (!caps?.ok)
              throw new ToolError('UNSUPPORTED', 'Gattsby could not check this browser.');
            validateToolAction(choice.tool, choice.input, stage, {
              registry: this.registry,
              state: this.state(),
              capabilities: caps.data as Capabilities,
              resolves: (evidence) => this.resolves(evidence),
            });
          },
          this.abort.signal,
        );
        this.choosingStage.set(null);
        if (this.leaving) return;
        if (!chosen) {
          this.concludeNow = true;
          this.resetSignalAfterStop();
          continue;
        }
        action = chosen;
        chosenByPerson = true;
      } else if (outcome.kind === 'ambiguous') {
        if (this.modelSession && caps?.ok) {
          if (!this.modelDecider) {
            const { ModelDecider } = await import('./model-decider');
            this.modelDecider = new ModelDecider(this.clock);
          }
          if (this.leaving) return;
          this.modelConsultations++;
          this.modelThinkingSignal.set(true);
          const reply = await this.modelDecider.decide(
            this.modelSession,
            {
              outcome,
              state: this.state(),
              capabilities: caps.data as Capabilities,
              hypothesis: this.hypothesis(),
              steps: this.steps(),
              stepBudget: this.config.stepBudget,
              registry: this.registry,
              kb: this.kbSignal()!,
              resolves: (evidence) => this.resolves(evidence),
            },
            this.abort.signal,
            this.config.modelTimeoutMs ?? 10_000,
          );
          this.modelThinkingSignal.set(false);
          if (this.leaving) return;
          modelDecision = reply.decision;
          if ('error' in reply) {
            refusal = reply.error;
            action = {
              tool: 'model_decision',
              input: {},
              stage: outcome.stage,
              ruleId: outcome.ruleId,
              message: { text: reply.error.message },
            };
          } else {
            action = reply.action;
          }
        } else {
          refusal = new ToolError('MODEL_SESSION_FAILED', 'The on-device model session stopped.');
          action = {
            tool: 'model_decision',
            input: {},
            stage: outcome.stage,
            ruleId: outcome.ruleId,
            message: { text: refusal.message },
          };
        }
      } else {
        action = outcome.action;
      }
      if (this.concludeNow && action.tool === 'finish' && this.stopReason === 'personStop') {
        action = { ...action, input: { ...action.input, verdict: 'stoppedByPerson' } };
      }
      const done = await this.runStep(id, action, modelDecision, refusal, chosenByPerson);
      if (done) return;
      if (action.tool === 'finish' && ++this.refusedFinishes >= MAX_REFUSED_FINISHES) {
        throw new Error('The verdict was refused twice; no verdict is supported.');
      }
      if (!this.concludeNow) {
        const next = nextOutcome(this.ruleContext());
        const checksDone = next?.kind === 'decided' && next.action.tool === 'finish';
        const reason = checkStop(
          { steps: this.steps().length, noProgressRun: this.noProgressRun },
          this.hypothesis()?.confidence ?? 0,
          checksDone,
          this.config,
        );
        if (reason) {
          this.stopReason = reason;
          this.concludeNow = true;
        }
      }
    }
  }

  /** Runs and commits one step; returns true once the verdict is issued. */
  private async runStep(
    id: string,
    action: RuleAction,
    modelDecision?: ModelDecision,
    refusal?: ToolError,
    chosenByPerson = false,
  ): Promise<boolean> {
    const kb = this.kbSignal()!;
    const tool = this.registry.get(action.tool);
    const n = this.steps().length + 1;
    const state = this.state();
    const labels = { kb, state };
    this.pending.set({
      action,
      label: tool ? tool.labels.running(action.input as never, labels) : action.tool,
      detail: tool?.labels.detail ?? null,
      card: !!tool?.labels.card,
    });
    this.log.setStep(n);
    const startedAt = this.clock.now();
    const observations: Observation[] = [];
    const recordings: Recording[] = [];
    const requests: MissingToolRequest[] = [];
    const handedOut: string[] = [];
    const signal = this.abort.signal;
    const ctx: ToolContext = {
      investigationId: id,
      stage: action.stage,
      stepN: n,
      state,
      ble: this.ble,
      notificationRecorder: this.notificationRecorder,
      confirmationCheck: this.confirmationCheck,
      controlPoint: this.controlPoint,
      controlTelemetry: this.controlTelemetry,
      lockControl: () => this.approvalLedger.lock(),
      kb,
      prompts: this.prompts,
      capabilities: { detect: () => this.capabilities.detect({ model: this.mode() === 'agent' }) },
      signal,
      hypotheses: {
        resolves: (evidenceId) => this.resolves(evidenceId),
        // The model proposes from journey 6; the rules' hypothesis is rescored after each step.
        propose: () => ({
          version: this.hypothesis()?.version ?? 0,
          confidence: this.hypothesis()?.confidence ?? 0,
        }),
      },
      verdictFacts: () =>
        this.facts([...this.requests(), ...requests], [...this.observations(), ...observations]),
      observe: (o) => {
        const observation: Observation = {
          ...o,
          investigationId: id,
          id: `o-${++this.observationCounter}`,
          stepN: n,
        };
        observations.push(observation);
        handedOut.push(observation.id);
        return observation.id;
      },
      saveRecording: (recording) => {
        recordings.push({ ...recording, investigationId: id, stepN: n });
        handedOut.push(recording.id);
        return recording.id;
      },
      recordedPackets: (recordingId) => this.store.recordedPackets(id, recordingId),
      raiseMissingTool: (r: NewMissingToolRequest) => {
        const existing = [...this.requests(), ...requests].find(
          (x) => x.capabilityKey === r.capabilityKey,
        );
        if (existing) return existing.id;
        const request: MissingToolRequest = {
          ...r,
          investigationId: id,
          id: `m-${++this.requestCounter}`,
          stepN: n,
          createdAt: Date.now(),
        };
        requests.push(request);
        handedOut.push(request.id);
        return request.id;
      },
    };
    let result: ToolResult<unknown>;
    let approval: ApprovalDecision | undefined;
    if (refusal) {
      result = fail(refusal.code, refusal.message);
    } else if (!tool) {
      result = fail('UNKNOWN_TOOL', `No tool named ${action.tool}.`);
    } else if (!tool.stages.includes(action.stage)) {
      result = fail('NOT_ALLOWED_AT_STAGE', `${action.tool} is not allowed at ${action.stage}.`);
    } else {
      result = await executeTool(
        tool,
        action.input,
        ctx,
        () => handedOut,
        this.approvalGate,
        (decision) => {
          approval = decision;
        },
      );
    }
    if (this.leaving) return true;
    const step: Step = {
      investigationId: id,
      n,
      id: `s-${n}`,
      mode: this.mode(),
      stage: action.stage,
      tool: action.tool,
      input: action.input,
      decidedBy: modelDecision
        ? 'model'
        : refusal
          ? 'orchestrator'
          : chosenByPerson
            ? 'checklist'
            : 'rules',
      ...(modelDecision ? { modelDecision } : {}),
      ...(approval ? { approval } : {}),
      ruleId: action.ruleId,
      startedAt,
      endedAt: this.clock.now(),
      status: result.ok
        ? 'completed'
        : result.error.code === 'ABORTED'
          ? 'interrupted'
          : (refusal && refusal.code !== 'TIMEOUT') || result.error.code === 'APPROVAL_DENIED'
            ? 'refused'
            : 'failed',
      result,
      message: action.message ?? null,
      exchange: exchangeOf(action, result),
      error: result.ok
        ? null
        : {
            code: result.error.code,
            message: result.error.message,
            tool: action.tool,
            stage: action.stage,
            at: Date.now(),
          },
    };
    const newState = applyStep(state, step);
    const allObservations = [...this.observations(), ...observations];
    const fresh = observations.filter((o) => !this.observationKeys.has(keyOf(o)));
    fresh.forEach((o) => this.observationKeys.add(keyOf(o)));
    this.noProgressRun = fresh.length > 0 ? 0 : this.noProgressRun + 1;
    const hypothesis = this.tracker!.rescore(
      n,
      newState,
      allObservations,
      kb,
      this.config,
      Date.now(),
      action.tool === 'update_hypothesis' && (modelDecision || chosenByPerson) && result.ok
        ? (action.input as unknown as UpdateHypothesisInput)
        : undefined,
    );
    const rawLog = this.log.takePending();

    if (action.tool === 'finish' && result.ok) {
      const data = result.data as { verdict: VerdictKind; label: string };
      const facts = this.facts([...this.requests(), ...requests], allObservations);
      const verdict: Verdict = {
        kind: data.verdict,
        protocol: facts.hypothesis?.protocol ?? null,
        label: verdictLabel(data.verdict, facts.hypothesis?.protocol ?? null),
        summary: String((action.input as { summary: string }).summary),
        stopReason: this.stopReason ?? 'finish',
        issuedAt: Date.now(),
        stepN: n,
        evidence: result.evidence,
      };
      this.statusSignal.set('concluding');
      this.approvalLedger.lock();
      this.releaseModel();
      await this.ble.disconnect();
      rawLog.push(...this.log.takePending());
      const referenced = [
        ...new Set(newState.readableMetrics.flatMap((metric) => metric.evidence)),
      ];
      const storedEvidence = await this.store.rawEvidence(id, referenced);
      const profile = buildProfile(
        this.investigationSignal()!,
        verdict,
        newState,
        kb,
        hypothesis ?? facts.hypothesis,
        allObservations,
        [...this.steps(), step],
        facts.missingToolRequests,
        [...storedEvidence, ...rawLog],
        this.log.count(),
      );
      const commit: VerdictCommit = {
        investigationId: id,
        step,
        rawLog,
        observations,
        hypothesis,
        missingToolRequests: requests,
        verdict,
        profile,
        investigationPatch: {
          status: verdict.kind === 'stoppedByPerson' ? 'stopped' : 'concluded',
          endedAt: Date.now(),
          stage: 'conclude',
          modelConsultations: this.modelConsultations,
          ...(this.emergencyEvent && {
            emergencyStoppedAt: this.emergencyEvent.tappedAt,
            emergencyStop: this.emergencyEvent,
          }),
        },
      };
      try {
        await this.store.commitVerdict(commit);
      } catch (error) {
        if (!(error instanceof StoreError) || error.code !== 'STORAGE_FULL') throw error;
        this.pendingVerdict.commit.set(commit);
      }
      this.pending.set(null);
      this.log.clear();
      this.statusSignal.set('concluded');
      await this.router.navigate(['/investigations', id, 'verdict'], { replaceUrl: true });
      return true;
    }

    const modeChange = this.fallbackAfter(step, refusal);
    const modePatch = modeChange && {
      mode: modeChange.to,
      modeChanges: [...(this.investigationSignal()?.modeChanges ?? []), modeChange],
    };
    await this.store.commitStep({
      investigationId: id,
      step,
      rawLog,
      recordings,
      observations,
      hypothesis,
      missingToolRequests: requests,
      investigationPatch: {
        stage: action.stage,
        modelConsultations: this.modelConsultations,
        ...modePatch,
        ...(newState.device?.name !== undefined ? { deviceName: newState.device.name } : {}),
      },
    });
    this.steps.update((steps) => [...steps, step]);
    this.observations.set(allObservations);
    this.requests.update((r) => [...r, ...requests]);
    if (hypothesis) this.hypotheses.update((h) => [...h, hypothesis]);
    if (modePatch) {
      this.releaseModel();
      this.noProgressRun = 0;
      this.investigationSignal.update((record) => record && { ...record, ...modePatch });
    }
    this.pending.set(null);
    this.resetSignalAfterStop();
    return false;
  }

  private fallbackAfter(step: Step, refusal?: ToolError): ModeChange | null {
    if (this.concludeNow || this.mode() !== 'agent' || (!step.modelDecision && !refusal))
      return null;
    const trigger = this.modelFailures.report(step.id, refusal?.code ?? null);
    return (
      trigger && {
        ...trigger,
        from: 'agent',
        to: 'checklist',
        at: step.endedAt,
        stage: step.stage,
        step: step.n,
      }
    );
  }

  private resetSignalAfterStop(): void {
    if (this.stopReason && this.abort.signal.aborted) {
      this.abort = new AbortController();
    }
  }

  private ruleContext() {
    return {
      state: this.state(),
      kb: this.kbSignal()!,
      config: this.config,
      facts: this.facts(this.requests(), this.observations()),
    };
  }

  private facts(
    requests: readonly MissingToolRequest[],
    observations: readonly Observation[],
  ): VerdictFacts {
    const hypothesis = this.hypothesis();
    return {
      hypothesis,
      observations,
      missingToolRequests: requests,
      everConnected: this.state().everConnected,
      stopReason: this.stopReason ?? 'finish',
      emergencyAcknowledged: this.emergencyEvent?.outcome === 'acknowledged',
      protocolKnown:
        !!hypothesis &&
        !!this.kbSignal()?.services.some((s) => s.shortName === hypothesis.protocol),
    };
  }

  private resolves(evidenceId: string): boolean {
    return (
      this.observations().some((o) => o.id === evidenceId) ||
      this.steps().some((s) => s.id === evidenceId) ||
      this.hypotheses().some((h) => h.id === evidenceId) ||
      this.requests().some((r) => r.id === evidenceId) ||
      this.log.latest(2000).some((r) => r.id === evidenceId)
    );
  }

  private fault(error: unknown): void {
    this.modelThinkingSignal.set(false);
    this.releaseModel();
    this.pending.set(null);
    this.statusSignal.set('error');
    this.errorSignal.set(
      error instanceof ToolDefect || error instanceof Error ? error.message : String(error),
    );
    console.warn('Gattsby stopped the investigation after an unexpected error:', error);
  }

  private releaseModel(): void {
    this.modelSession?.destroy();
    this.modelSession = null;
  }
}

function keyOf(o: Observation): string {
  return `${o.kind}|${o.subject}|${o.value}`;
}

function askOf(action: RuleAction): { text: string; why: string | null } | null {
  const input = action.input as {
    question?: string;
    instruction?: string;
    why?: string;
    title?: string;
  };
  if (action.tool === 'ask_user' && input.question) return { text: input.question, why: null };
  if (action.tool === 'request_action' && input.instruction && !input.title) {
    return { text: input.instruction, why: input.why ?? null };
  }
  return null;
}

function exchangeOf(action: RuleAction, result: ToolResult<unknown>): StepPersonExchange | null {
  const ask = askOf(action);
  if (!ask || !result.ok) return null;
  const data = result.data as { answer?: string; skipped: boolean };
  return { prompt: ask.text, why: ask.why, answer: data.answer ?? 'Done', skipped: data.skipped };
}
