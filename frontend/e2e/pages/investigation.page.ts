import { expect, type Locator, type Page } from '@playwright/test';

// The Investigation page at `/investigations/:id` (docs/mocks/pages/investigation/*.html): the app
// bar, the stage track, the activity feed, the prompt dock and the side panel.
export class InvestigationPage {
  get options() {
    return this.page.getByRole('button', { name: 'Investigation options' });
  }
  readonly title: Locator;
  readonly subtitle: Locator;
  readonly stageTrack: Locator;
  readonly feed: Locator;
  readonly dock: Locator;
  readonly promptTitle: Locator;
  readonly promptEyebrow: Locator;
  readonly promptDetail: Locator;
  readonly hypothesis: Locator;
  readonly confidence: Locator;
  readonly devicePanel: Locator;
  readonly emergencyStop: Locator;
  readonly connectionBanner: Locator;
  readonly modeBanner: Locator;
  readonly dismissModeBanner: Locator;
  readonly addNote: Locator;
  readonly freeText: Locator;
  readonly leave: Locator;
  readonly liveRate: Locator;

  constructor(private readonly page: Page) {
    this.title = page.locator('.appbar__title');
    this.subtitle = page.locator('.appbar__subtitle');
    this.stageTrack = page.getByRole('list', { name: /^Playbook, stage/ });
    this.feed = page.getByRole('region', { name: 'Activity' });
    this.dock = page.locator('.inv__prompt');
    this.promptTitle = this.dock.locator('.prompt__title');
    this.promptEyebrow = this.dock.locator('.prompt__eyebrow');
    this.promptDetail = this.dock.locator('.prompt__detail');
    this.hypothesis = page.locator('.panel-hypo');
    this.confidence = page.locator('.inv__panel .meter__value');
    this.devicePanel = page.getByRole('complementary', {
      name: 'Hypothesis, live readings and device',
    });
    this.emergencyStop = page.getByRole('button', { name: 'Emergency stop' });
    this.connectionBanner = page.locator('.conn-banner');
    this.modeBanner = page.getByRole('status', { name: 'Operating mode' });
    this.dismissModeBanner = page.getByRole('button', { name: 'Dismiss mode notice' });
    this.addNote = page.getByRole('button', { name: 'Add a note' });
    this.freeText = this.dock.getByRole('textbox');
    this.leave = page.getByRole('link', { name: 'Leave the investigation' });
    this.liveRate = this.devicePanel.locator('.live-badge');
  }

  id(): string {
    const match = /\/investigations\/([^/]+)/.exec(new URL(this.page.url()).pathname);
    if (!match) throw new Error(`Not an investigation address: ${this.page.url()}`);
    return match[1];
  }

  async goto(id: string): Promise<void> {
    await this.page.goto(`/investigations/${id}`);
  }

  /** The stage the track marks as current, from its accessible name. */
  async currentStage(): Promise<string> {
    const label = (await this.stageTrack.getAttribute('aria-label')) ?? '';
    return label.replace(/^Playbook, stage \d of 7: /, '');
  }

  stageState(stage: string): Locator {
    return this.stageTrack.getByText(new RegExp(`^${stage}: `));
  }

  answer(name: string): Locator {
    return this.dock.getByRole('button', { name, exact: true });
  }

  async choose(name: string): Promise<void> {
    await this.answer(name).click();
  }

  async chooseRecovery(name: 'Try again' | 'Stop'): Promise<void> {
    await this.connectionBanner.getByRole('button', { name, exact: true }).click();
  }

  async typeAnswer(text: string): Promise<void> {
    await this.freeText.fill(text);
    await this.dock.getByRole('button', { name: 'Send answer' }).click();
  }

  async waitForPrompt(title: string): Promise<void> {
    await expect(this.promptTitle).toHaveText(title);
  }

  feedMessages(): Locator {
    return this.feed.locator('.msg__text');
  }

  liveMetric(label: string): Locator {
    return this.page
      .locator('.reading, .readings__row')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .filter({ visible: true })
      .first();
  }

  feedTool(tool: string): Locator {
    return this.feed
      .locator('.probe')
      .filter({ has: this.page.locator('.probe__tool', { hasText: tool }) });
  }

  panelValue(term: string): Locator {
    return this.devicePanel
      .locator('dt', { hasText: term })
      .locator('xpath=following-sibling::dd[1]');
  }

  /** Answers the three Prepare questions. */
  async prepare(machineType: string, brand: string): Promise<void> {
    await this.waitForPrompt('What kind of machine is it?');
    await this.choose(machineType);
    await this.waitForPrompt('Is there a brand on it?');
    await this.choose(brand);
    await expect(this.promptTitle).toHaveText(/Switch it on/);
    await this.choose('Done');
  }
}
