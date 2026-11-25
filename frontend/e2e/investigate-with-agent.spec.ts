// Traces to: FR-005, FR-006, FR-041, FR-042, FR-043, FR-044, FR-045, FR-046, FR-047, FR-048, FR-058, FR-071, TOOL-029, NFR-001, NFR-020
// Given a model is available, when the person turns off full agent mode in Settings,
// then the choice survives reload and the next investigation starts as a checklist.

import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { ExportDialogPage } from './pages/export.dialog.page';
import { HomePage } from './pages/home.page';
import { InvestigationPage } from './pages/investigation.page';
import { SettingsPage } from './pages/settings.page';
import { VerdictPage } from './pages/verdict.page';
import type { Page } from '@playwright/test';

const ambiguousTreadmill = {
  devices: [devices.treadmill.id],
  chooser: [{ pick: devices.treadmill.id }],
  permittedServices: [0xfff0],
  omitCharacteristics: [0x2ad9],
};

async function beginTreadmill(page: Page): Promise<InvestigationPage> {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.prepare('Treadmill', 'Don’t know');
  return investigation;
}

test('uses the saved choice to start without calling the model', async ({ page, fakeModel }) => {
  const home = new HomePage(page);
  const settings = new SettingsPage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.settings.click({ timeout: 3_000 });
  await expect(settings.useAgent).toBeChecked();
  await settings.useAgent.uncheck();
  await expect(settings.useAgent).toBeEnabled();
  await page.reload();
  await expect(settings.useAgent).not.toBeChecked();
  const before = fakeModel.calls().length;
  await settings.back.click();
  await expect(home.modeChip).toHaveText('Checklist mode');
  await home.identify();
  await investigation.waitForPrompt('What kind of machine is it?');
  await expect(investigation.subtitle).toHaveText('Checklist · Prepare');
  expect(await new StoredRecords(page).investigation(investigation.id())).toMatchObject({
    mode: 'checklist',
  });
  expect(fakeModel.calls()).toHaveLength(before);
});

test('opens one agent session before Prepare and releases it when leaving', async ({
  page,
  fakeModel,
}) => {
  const home = new HomePage(page);
  const investigation = new InvestigationPage(page);
  await home.goto();
  await home.identify();
  await investigation.waitForPrompt('What kind of machine is it?');
  await expect(investigation.subtitle).toHaveText('Agent · Prepare');
  expect(fakeModel.calls().filter((method) => method === 'create')).toHaveLength(1);
  expect(fakeModel.prompts()).toEqual([]);
  await investigation.leave.click();
  await expect.poll(() => fakeModel.calls()).toContain('destroy');
});

test.describe('The model refuses a session', () => {
  test.use({
    model: { availability: 'available', createError: 'NotSupportedError', responses: [] },
  });
  test('starts in checklist mode when Chrome cannot create the session', async ({
    page,
    fakeModel,
  }) => {
    const home = new HomePage(page);
    const investigation = new InvestigationPage(page);
    await home.goto();
    await home.identify();
    await investigation.waitForPrompt('What kind of machine is it?');
    await expect(investigation.subtitle).toHaveText('Checklist · Prepare');
    expect(fakeModel.calls().filter((method) => method === 'create')).toHaveLength(1);
    expect(fakeModel.prompts()).toEqual([]);
  });
});

test.describe('Two plausible protocols on the FTMS treadmill', () => {
  test.use({
    bluetooth: ambiguousTreadmill,
    model: {
      availability: 'available',
      responses: [
        {
          action: {
            type: 'call_tool',
            tool: 'update_hypothesis',
            input: { protocol: 'FTMS', proposedConfidence: 1, evidence: ['s-7'] },
            why: 'Treadmill Data is a stronger fit for this machine.',
          },
        },
      ],
    },
  });

  test('consults the model once at the ambiguous step and confirms FTMS @critical', async ({
    page,
    fakeBluetooth,
    fakeModel,
  }) => {
    const investigation = await beginTreadmill(page);
    expect(fakeModel.prompts()).toEqual([]);
    await investigation.choose('Find the device');
    await expect.poll(() => fakeModel.prompts().length, { timeout: 3_000 }).toBe(1);
    const [prompt] = fakeModel.prompts();
    expect(prompt).toContain('FTMS');
    expect(prompt).toContain('0000fff0');
    expect(prompt).not.toMatch(/(?:\b[0-9a-f]{2}\s+){5}/i);
    const [constraint] = fakeModel.constraints() as {
      oneOf: { properties: { type: { const: string }; tool?: { enum: string[] } } }[];
    }[];
    expect(constraint.oneOf.map((choice) => choice.properties.type.const)).toEqual([
      'call_tool',
      'ask_user',
      'update_hypothesis',
      'request_missing_tool',
      'finish',
    ]);
    const tools = constraint.oneOf[0].properties.tool?.enum ?? [];
    expect(tools).toContain('read_characteristic');
    expect(tools).not.toContain('scan_devices');
    expect(tools).not.toContain('request_action');
    await expect(investigation.feed).toContainText(
      'Treadmill Data is a stronger fit for this machine.',
    );
    await fakeBluetooth.setEffort(1);
    await investigation.choose('Ready');
    await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
    await page.clock.runFor(11_000);
    await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
    await fakeBluetooth.setEffort(2);
    await page.clock.runFor(1_100);
    await investigation.choose('Done');
    await investigation.waitForPrompt('Raise the incline to 2%, and keep the same speed.');
    await fakeBluetooth.setIncline(2);
    await page.clock.runFor(1_100);
    await investigation.choose('Done');
    await expect(new VerdictPage(page).title).toHaveText('Connected — FTMS');
    const id = investigation.id();
    const records = new StoredRecords(page);
    expect(await records.investigation(id)).toMatchObject({ mode: 'agent', modelConsultations: 1 });
    expect(await records.steps(id)).toContainEqual(
      expect.objectContaining({ tool: 'update_hypothesis', decidedBy: 'model' }),
    );
    expect(fakeModel.prompts()).toHaveLength(1);
    expect(fakeBluetooth.writes()).toEqual([]);
    expect(await page.evaluate(() => performance.now())).toBeLessThan(180_000);
  });
});

test.describe('The model proposes reads that cannot run', () => {
  test.use({
    bluetooth: ambiguousTreadmill,
    model: {
      availability: 'available',
      responses: [
        { action: { type: 'call_tool', tool: '<b>unknown</b>', input: {} } },
        {
          action: {
            type: 'call_tool',
            tool: 'read_characteristic',
            input: { service: '0000fff0-0000-1000-8000-00805f9b34fb' },
          },
        },
        {
          action: {
            type: 'call_tool',
            tool: 'read_characteristic',
            input: {
              service: '0000fff0-0000-1000-8000-00805f9b34fb',
              characteristic: '0000ffff-0000-1000-8000-00805f9b34fb',
            },
          },
        },
      ],
    },
  });

  test('records each refusal, explains it in the next prompt and reaches a verdict', async ({
    page,
    fakeBluetooth,
    fakeModel,
  }) => {
    const investigation = await beginTreadmill(page);
    await investigation.choose('Find the device');
    await expect(investigation.modeBanner).toContainText('Continuing as a checklist.');
    await investigation.waitForPrompt('Pick the next step');
    const id = investigation.id();
    const records = new StoredRecords(page);
    const refused = (await records.steps(id)).filter((step) => step.decidedBy === 'model');
    expect(refused.map((step) => step.result.error?.code)).toEqual([
      'UNKNOWN_TOOL',
      'INVALID_INPUT',
      'PRECONDITION_FAILED',
    ]);
    expect(refused.every((step) => step.status === 'refused')).toBe(true);
    expect(await records.investigation(id)).toMatchObject({
      mode: 'checklist',
      modeChanges: [
        {
          from: 'agent',
          to: 'checklist',
          reason: 'threeInvalidActions',
          stage: 'identify',
          rejectedActionIds: refused.map((step) => step.id),
        },
      ],
    });
    expect(fakeModel.prompts()[1]).toContain('Unknown tool: <b>unknown</b>');
    expect(fakeModel.prompts()[2]).toContain('input for read_characteristic is incomplete');
    expect(fakeBluetooth.writes()).toEqual([]);
    expect(fakeBluetooth.calls().filter((call) => call === 'readValue')).toHaveLength(3);
    await investigation.emergencyStop.click();
    await expect(new VerdictPage(page).title).toBeVisible();
  });
});

test.describe('The model returns unstructured or forbidden actions', () => {
  test.use({
    bluetooth: ambiguousTreadmill,
    model: {
      availability: 'available',
      responses: [
        { rawText: '{} {}' },
        {
          action: {
            type: 'call_tool',
            tool: 'request_action',
            input: { instruction: 'Use the console' },
          },
        },
        { action: { type: 'call_tool', tool: 'send_command', input: {} } },
      ],
    },
  });

  test('refuses malformed output, physical prompts and unavailable writes', async ({
    page,
    fakeBluetooth,
  }) => {
    const investigation = await beginTreadmill(page);
    await investigation.choose('Find the device');
    await expect(investigation.modeBanner).toContainText('Continuing as a checklist.');
    const refused = (await new StoredRecords(page).steps(investigation.id())).filter(
      (step) => step.decidedBy === 'model',
    );
    expect(refused.map((step) => step.result.error?.code)).toEqual([
      'INVALID_INPUT',
      'NOT_ALLOWED_AT_STAGE',
      'UNKNOWN_TOOL',
    ]);
    expect(fakeBluetooth.writes()).toEqual([]);
  });
});

test.describe('The model takes longer than ten seconds', () => {
  test.use({
    bluetooth: ambiguousTreadmill,
    model: {
      availability: 'available',
      responses: [
        { rawText: '{}', delayMs: 30_000 },
        { rawText: '{}', delayMs: 30_000 },
      ],
    },
  });

  test('aborts both timed-out calls and finishes using the same checklist at Identify', async ({
    page,
    fakeModel,
    fakeBluetooth,
  }) => {
    const investigation = await beginTreadmill(page);
    await investigation.choose('Find the device');
    await expect.poll(() => fakeModel.prompts().length).toBe(1);
    await investigation.waitForPrompt('Choosing the next step');
    await page.clock.runFor(10_050);
    await expect.poll(() => fakeModel.prompts().length).toBe(2);
    await page.clock.runFor(10_050);
    await expect(investigation.modeBanner).toContainText('Continuing as a checklist.');
    await expect(investigation.modeBanner).toContainText('stopped answering twice in a row');
    await expect(investigation.subtitle).toHaveText('Checklist · Identify');
    await investigation.waitForPrompt('Pick the next step');
    const id = investigation.id();
    const records = new StoredRecords(page);
    const calls = (await records.steps(id)).filter((step) => step.decidedBy === 'model');
    expect(calls.map((step) => step.result.error?.code)).toEqual(['TIMEOUT', 'TIMEOUT']);
    expect(calls.every((step) => step.mode === 'agent')).toBe(true);
    expect(await records.investigation(id)).toMatchObject({
      modelConsultations: 2,
      mode: 'checklist',
      modeChanges: [
        {
          reason: 'twoTimeouts',
          stage: 'identify',
          step: calls[1].n,
          rejectedActionIds: [],
        },
      ],
    });
    expect(fakeModel.calls().filter((call) => call === 'destroy')).toHaveLength(3);
    await expect(investigation.panelValue('Maker')).toHaveText('Johnson Health Tech');
    await investigation.choose('FTMS treadmill');
    await investigation.choose('Read supported ranges');
    await fakeBluetooth.setEffort(1);
    await investigation.choose('Ready');
    await expect.poll(() => fakeBluetooth.calls()).toContain('startNotifications');
    await page.clock.runFor(10_500);
    await investigation.waitForPrompt('Now speed up to about 6 km/h. Change only the speed.');
    await fakeBluetooth.setEffort(2);
    await page.clock.runFor(2_100);
    await investigation.choose('Done');
    await investigation.waitForPrompt('Raise the incline to 2%, and keep the same speed.');
    await investigation.choose('Skip');
    const verdict = new VerdictPage(page);
    await expect(verdict.title).toHaveText('Connected — FTMS');
    await expect(verdict.item('Can read', 'Speed')).toContainText('confirmed');
    expect(
      (await records.steps(id)).find((step) => step.tool === 'update_hypothesis'),
    ).toMatchObject({
      decidedBy: 'checklist',
      mode: 'checklist',
    });
    expect(fakeModel.prompts()).toHaveLength(2);
    await verdict.exportRecord.click();
    const download = page.waitForEvent('download');
    await new ExportDialogPage(page).fullRecord.click();
    const exported = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
    expect(exported.investigation.modeChanges).toMatchObject([
      { from: 'agent', to: 'checklist', reason: 'twoTimeouts', stage: 'identify' },
    ]);
  });

  test('emergency stop aborts the pending model call before the timeout', async ({
    page,
    fakeModel,
    fakeBluetooth,
  }) => {
    const investigation = await beginTreadmill(page);
    await investigation.choose('Find the device');
    await expect.poll(() => fakeModel.prompts().length).toBe(1);
    const start = await page.evaluate(() => performance.now());
    await investigation.emergencyStop.click();
    await expect(new VerdictPage(page).title).toBeVisible();
    expect((await page.evaluate(() => performance.now())) - start).toBeLessThan(10_000);
    const id = investigation.id();
    const records = new StoredRecords(page);
    const calls = (await records.steps(id)).filter((step) => step.decidedBy === 'model');
    expect(calls.map((step) => step.result.error?.code)).toEqual(['ABORTED']);
    expect(await records.investigation(id)).toMatchObject({
      verdict: { stopReason: 'emergencyStop' },
    });
    expect(fakeBluetooth.writes()).toEqual([]);
  });

  test('leaving during a model call releases it and leaves Home open', async ({
    page,
    fakeModel,
  }) => {
    const investigation = await beginTreadmill(page);
    await investigation.choose('Find the device');
    await expect.poll(() => fakeModel.prompts().length).toBe(1);
    const id = investigation.id();
    await investigation.leave.click();
    await expect.poll(() => fakeModel.calls().filter((call) => call === 'destroy').length).toBe(2);
    await page.clock.runFor(500);
    await expect(page).toHaveURL('/');
    expect(await new StoredRecords(page).investigation(id)).toMatchObject({ verdict: null });
  });
});

test.describe('The model reports a missing tool twice', () => {
  test.use({
    bluetooth: ambiguousTreadmill,
    model: {
      availability: 'available',
      responses: [
        {
          action: {
            type: 'request_missing_tool',
            capability: 'Console data decoder',
            reason: 'The console service has an unknown format.',
            evidence: ['s-7'],
          },
        },
        {
          action: {
            type: 'request_missing_tool',
            capability: 'Console data decoder',
            reason: 'The console service still has an unknown format.',
            evidence: ['s-7'],
          },
        },
        {
          action: {
            type: 'ask_user',
            question: 'Is there another name on the console?',
            answers: ['Yes', 'No'],
            why: 'It may help identify the console protocol.',
          },
        },
      ],
    },
  });

  test('keeps one request and reuses its evidence ID', async ({ page }) => {
    const investigation = await beginTreadmill(page);
    await investigation.choose('Find the device');
    await investigation.waitForPrompt('Is there another name on the console?');
    const records = new StoredRecords(page);
    const id = investigation.id();
    await expect
      .poll(async () =>
        (await records.steps(id))
          .filter((step) => step.tool === 'request_missing_tool')
          .map((step) => step.result.data),
      )
      .toEqual([
        { requestId: 'm-1', merged: false },
        { requestId: 'm-1', merged: true },
      ]);
    expect(await records.missingToolRequests(id)).toEqual([
      expect.objectContaining({
        id: 'm-1',
        title: 'Console data decoder',
        evidence: ['s-7'],
      }),
    ]);
  });
});

test.describe('The on-device model session stops mid-investigation', () => {
  test.use({
    bluetooth: ambiguousTreadmill,
    model: {
      availability: 'available',
      responses: [{ error: 'InvalidStateError' }],
    },
  });

  test('keeps Identify open and records why the checklist took over', async ({
    page,
    fakeModel,
  }) => {
    const investigation = await beginTreadmill(page);
    await investigation.choose('Find the device');
    await expect(investigation.modeBanner).toContainText('The on-device model session stopped.');
    await investigation.waitForPrompt('Pick the next step');
    expect(await new StoredRecords(page).investigation(investigation.id())).toMatchObject({
      mode: 'checklist',
      stage: 'identify',
      modelConsultations: 1,
      modeChanges: [{ reason: 'sessionFailed', stage: 'identify' }],
    });
    expect(fakeModel.prompts()).toHaveLength(1);
  });
});

test.describe('An investigation prompt exceeds the model context', () => {
  test.use({
    bluetooth: ambiguousTreadmill,
    model: { availability: 'available', responses: [], inputQuota: 512 },
  });

  test('keeps Identify open without calling prompt', async ({ page, fakeModel }) => {
    const investigation = await beginTreadmill(page);
    await investigation.choose('Find the device');
    await expect(investigation.modeBanner).toContainText('ran out of space in the on-device model');
    await investigation.waitForPrompt('Pick the next step');
    expect(await new StoredRecords(page).investigation(investigation.id())).toMatchObject({
      mode: 'checklist',
      stage: 'identify',
      modeChanges: [{ reason: 'contextExhausted', stage: 'identify' }],
    });
    expect(fakeModel.prompts()).toEqual([]);
  });
});
