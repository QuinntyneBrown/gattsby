// Traces to: FR-053, FR-054, FR-056, FR-058, FR-059, FR-073, NFR-013, TOOL-029

import { finishTreadmill } from './fixtures/finish-treadmill';
import { expect, test } from './fixtures/gattsby-test';
import { devices } from './fixtures/scripted-ids';
import { StoredRecords } from './fixtures/stored-records';
import { EvidencePage } from './pages/evidence.page';
import { VerdictPage } from './pages/verdict.page';

test.use({
  bluetooth: { devices: [devices.treadmill.id], chooser: [{ pick: devices.treadmill.id }] },
});

// Given a confirmed speed reading, when the person opens its evidence from the verdict,
// then the record shows the actual raw notifications, decoded speed and timestamps.
test('opens the timestamped notifications that confirmed speed @critical', async ({
  page,
  fakeBluetooth,
}) => {
  const id = await finishTreadmill(page, fakeBluetooth);
  const records = new StoredRecords(page);
  const observations = await records.observations(id);
  const speed = observations.find(
    ({ kind, subject }) => kind === 'metric-confirmed' && subject === 'speed',
  );
  const cited = (await records.rawLog(id)).filter(
    (row) => row.kind === 'notification' && speed?.evidence.includes(row.id),
  );
  expect(cited.length).toBeGreaterThanOrEqual(2);
  const speedEvidence = new VerdictPage(page).evidenceFor('Can read', 'Speed');
  await expect(speedEvidence).toBeVisible();
  await speedEvidence.click();
  const evidence = new EvidencePage(page);
  await expect(evidence.title).toBeVisible();
  for (const packet of cited) {
    await expect(evidence.entry(packet.id)).toContainText(packet.hex);
    await expect(evidence.entry(packet.id)).toContainText(/Speed .*km\/h/);
    await expect(evidence.timestamp(packet.id)).toHaveAttribute(
      'datetime',
      new Date(packet.t).toISOString(),
    );
  }
  expect(fakeBluetooth.writes()).toEqual([]);
});

// Given a selected set of received packets, the Sent filter shows no matches.
// Switching to the full timeline lets the person open their answers and hypothesis changes.
test('filters the evidence by direction and author', async ({ page, fakeBluetooth }) => {
  await finishTreadmill(page, fakeBluetooth);
  await new VerdictPage(page).evidenceFor('Can read', 'Speed').click();
  const evidence = new EvidencePage(page);
  await evidence.filter('Sent').click({ timeout: 4_000 });
  await expect(evidence.filter('Sent')).toHaveAttribute('aria-pressed', 'true');
  await expect(evidence.noMatches).toBeVisible();
  await expect(evidence.entries).toHaveCount(0);
  await evidence.showEverything.first().click();
  await evidence.filter('You').click();
  await expect(evidence.entries).toContainText('Treadmill');
  await expect(evidence.entries).not.toContainText('0x2ACD');
  await evidence.filter('Agent').click();
  await expect(evidence.entries).toContainText('Hypothesis');
  await evidence.filter('Received').click();
  await expect(evidence.entries).toContainText('0x2ACD');
  await expect(evidence.entries).not.toContainText('Hypothesis');
});
