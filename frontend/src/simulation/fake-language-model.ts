import { FakeLanguageModelSession } from './fake-language-model-session';
import type { ModelScript, ScriptedResponse } from './simulation-config';
import type { Report } from './simulation-event';

interface CreateOptions {
  readonly monitor?: (monitor: EventTarget) => void;
  readonly signal?: AbortSignal;
}

const DOWNLOAD_STEP_MS = 1000;

// The parts of Chrome's `LanguageModel` the model adapter uses: a scripted availability, download
// progress for a model that is downloadable or downloading, and sessions that answer from the
// script's queue of responses.
export class FakeLanguageModel {
  private readonly responses: ScriptedResponse[];

  constructor(
    private readonly script: ModelScript,
    private readonly report: Report,
  ) {
    this.responses = [...script.responses];
  }

  async availability(): Promise<string> {
    this.report({ kind: 'model-call', method: 'availability' });
    return this.script.availability;
  }

  async params(): Promise<Record<string, number>> {
    this.report({ kind: 'model-call', method: 'params' });
    return { defaultTopK: 3, maxTopK: 128, defaultTemperature: 1, maxTemperature: 2 };
  }

  async create(options: CreateOptions = {}): Promise<FakeLanguageModelSession> {
    this.report({ kind: 'model-call', method: 'create' });
    if (this.script.availability === 'unavailable') {
      throw new DOMException('The model is not available.', 'NotSupportedError');
    }
    if (this.script.availability !== 'available') {
      const monitor = new EventTarget();
      options.monitor?.(monitor);
      for (const loaded of [0, 0.5, 1]) {
        await new Promise((resolve) => setTimeout(resolve, loaded === 0 ? 0 : DOWNLOAD_STEP_MS));
        monitor.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded }));
      }
    }
    return new FakeLanguageModelSession(this.responses, this.report);
  }
}
