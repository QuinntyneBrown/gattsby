import { describe, expect, it, vi } from 'vitest';
import { realKnowledgeBase } from '../knowledge-base/knowledge-base.fixture';
import type { ModelSession } from '../model/model-session';
import type { Step } from '../store/model/step';
import { TOOL_CATALOG } from '../tools/tool-catalog';
import { ToolRegistry } from '../tools/tool-registry';
import { ok } from '../tools/tool-result';
import { INITIAL_STATE } from './decision-state';
import type { ModelDecisionContext } from './model-decision-context';
import { composePrompt } from './prompt-composer';

function step(n: number): Step {
  return {
    investigationId: 'investigation',
    n,
    id: `s-${n}`,
    stage: 'identify',
    tool: 'read_characteristic',
    input: {},
    decidedBy: 'rules',
    ruleId: null,
    startedAt: 0,
    endedAt: 0,
    status: 'completed',
    result: ok('Read aa bb cc dd ee ff and ffeeddccbbaa.', { payload: 'raw-value' }),
    message: null,
    exchange: null,
    error: null,
  };
}

const registry = new ToolRegistry(TOOL_CATALOG);
const context: ModelDecisionContext = {
  outcome: { kind: 'ambiguous', stage: 'identify', ruleId: 'identify.choose', options: [] },
  state: { ...INITIAL_STATE, brand: 'x'.repeat(200) },
  capabilities: {
    secureContext: true,
    bluetooth: { api: true, adapterAvailable: true, blocked: false },
    model: { api: true, availability: 'available', imageInput: false },
    watchAdvertisements: false,
    requestLEScan: false,
    getDevices: false,
    camera: false,
    storage: { open: true, persisted: false, quotaBytes: 0, usageBytes: 0 },
    platform: { os: 'test', browser: 'Chrome', version: '', mobile: false },
  },
  hypothesis: null,
  steps: Array.from({ length: 12 }, (_, index) => step(index + 1)),
  stepBudget: 60,
  registry,
  kb: realKnowledgeBase(),
  resolves: () => true,
};

function session(measure: ModelSession['measure']): ModelSession {
  return { measure, promptBudget: 100, ask: vi.fn(), destroy: vi.fn() };
}

describe('Decision prompts (FR-041, FR-044, NFR-020)', () => {
  it('sends summaries of the last five steps with bounded device text and no payloads', async () => {
    const model = session(vi.fn(async () => 70));
    const result = await composePrompt(context, registry.forStage('identify'), model);
    expect(result.prompt).toContain('"id":"s-8"');
    expect(result.prompt).toContain('"id":"s-12"');
    expect(result.prompt).not.toContain('"id":"s-7"');
    expect(result.prompt).toContain('Read [bytes omitted] and [bytes omitted].');
    expect(result.prompt).not.toContain('raw-value');
    expect(result.prompt).toContain(`"brandAnswer":"${'x'.repeat(120)}"`);
    expect(model.measure).toHaveBeenCalledWith(result.prompt, result.responseConstraint);
  });

  it('drops the oldest summary first and preserves the available tools', async () => {
    const model = session(async (prompt) => (prompt.includes('"id":"s-8"') ? 110 : 85));
    const result = await composePrompt(context, registry.forStage('identify'), model);
    expect(result.prompt).not.toContain('"id":"s-8"');
    expect(result.prompt).toContain('"id":"s-9"');
    expect(result.prompt).toContain('read_characteristic');
    expect(result.tokens).toBe(85);
  });

  it('refuses a prompt that still cannot fit after dropping all summaries', async () => {
    const model = session(async () => 101);
    await expect(
      composePrompt(context, registry.forStage('identify'), model),
    ).rejects.toMatchObject({ code: 'CONTEXT_EXHAUSTED' });
    expect(model.ask).not.toHaveBeenCalled();
  });
});
