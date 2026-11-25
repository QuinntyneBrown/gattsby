import type { KnowledgeBaseIndex } from '../knowledge-base/knowledge-base-index';
import { confidenceWord } from '../outcome/confidence-scorer';
import type { Hypothesis } from '../store/model/hypothesis';
import type { Observation } from '../store/model/observation';
import type { Step } from '../store/model/step';
import type { ToolRegistry } from '../tools/tool-registry';
import { stateFrom } from './decision-state';
import type { FeedEntry } from './feed-entry';
import { STAGE_NAMES } from './stage-names';

const SHOWN_TAGS = new Set(['likely', 'guess']);

// Rebuilds the feed from the committed steps, so a reopened investigation shows what it showed
// while running (follow-the-investigation design). Pure.
export function buildFeed(
  steps: readonly Step[],
  observations: readonly Observation[],
  hypotheses: readonly Hypothesis[],
  registry: ToolRegistry,
  kb: KnowledgeBaseIndex,
  speaker: 'agent' | 'checklist',
): FeedEntry[] {
  const feed: FeedEntry[] = [];
  let stage: string | null = null;
  const ordered = [...steps].sort((a, b) => a.n - b.n);
  ordered.forEach((step, index) => {
    const stepSpeaker = step.mode ?? speaker;
    if (step.stage !== stage) {
      stage = step.stage;
      feed.push({
        kind: 'stageStart',
        id: `stage-${step.n}`,
        stage: step.stage,
        title: STAGE_NAMES[step.stage],
      });
    }
    if (step.message) {
      feed.push({
        kind: 'message',
        id: `say-${step.n}`,
        speaker: stepSpeaker,
        text: step.message.text,
        why: step.message.why ?? null,
      });
    }
    const tool = registry.get(step.tool);
    if (step.exchange) {
      feed.push({
        kind: 'message',
        id: `ask-${step.n}`,
        speaker: stepSpeaker,
        text: step.exchange.prompt,
        why: step.exchange.why ?? null,
      });
      feed.push({
        kind: 'message',
        id: `answer-${step.n}`,
        speaker: 'person',
        text: step.exchange.skipped ? 'Skipped' : step.exchange.answer,
        why: null,
      });
    } else if (tool?.labels.card) {
      const before = stateFrom(ordered.slice(0, index));
      feed.push({
        kind: 'tool',
        id: step.id,
        tool: step.tool,
        purpose: tool.labels.purpose(step.input as never, { kb, state: before }),
        durationMs: step.endedAt - step.startedAt,
        summary: step.result.ok
          ? step.result.summary
          : step.result.summary || step.result.error.message,
        failed: !step.result.ok,
        running: false,
        observations: observations
          .filter(
            (o) => o.stepN === step.n && (step.tool === 'enumerate_gatt' || SHOWN_TAGS.has(o.tag)),
          )
          .map((o) => ({ text: o.text, tag: o.tag })),
      });
    }
    for (const h of hypotheses.filter((v) => v.stepN === step.n)) {
      const previous = hypotheses.find((v) => v.version === h.previousVersion);
      feed.push({
        kind: 'hypothesis',
        id: h.id,
        label: h.label,
        from: Math.round((previous?.confidence ?? 0) * 100),
        to: Math.round(h.confidence * 100),
        word: confidenceWord(h.confidence),
      });
    }
  });
  return feed;
}
