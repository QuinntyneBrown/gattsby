import { PHONE_MODEL_WORKER_SCRIPT } from '../security/script-url-allowlist';
import { trustedScriptUrl } from '../security/trusted-types-policy';
import { MODEL_INSTRUCTIONS } from './model-instructions';
import type { ModelSession } from './model-session';
import type { PhoneModelManifest } from './phone-model-manifest';

export class WebGpuModelSession implements ModelSession {
  private sequence = 0;
  private destroyed = false;
  private readonly pending = new Map<number, (value: unknown, error?: Error) => void>();

  private constructor(
    private readonly worker: Worker,
    readonly promptBudget: number,
  ) {
    worker.addEventListener('message', ({ data }: MessageEvent<unknown>) => {
      if (typeof data !== 'object' || data === null) return;
      const { id, value, error } = data as Record<string, unknown>;
      if (typeof id !== 'number') return;
      this.pending.get(id)?.(value, typeof error === 'string' ? new Error(error) : undefined);
    });
    worker.addEventListener('error', (event) => {
      event.preventDefault();
      this.destroy();
    });
    worker.addEventListener('messageerror', () => this.destroy());
  }

  static async open(
    manifest: PhoneModelManifest,
    cacheName: string,
    signal: AbortSignal,
  ): Promise<WebGpuModelSession> {
    signal.throwIfAborted();
    const worker = new Worker(trustedScriptUrl(PHONE_MODEL_WORKER_SCRIPT), { type: 'module' });
    const session = new WebGpuModelSession(worker, manifest.contextWindow - 512);
    try {
      const ready = await session.request(
        { type: 'open', cacheName, files: manifest.files, instructions: MODEL_INSTRUCTIONS },
        signal,
      );
      if (ready !== true) throw new Error('The phone model could not open a session.');
      return session;
    } catch (error) {
      session.destroy();
      throw error;
    }
  }

  async measure(prompt: string, schema: object): Promise<number> {
    const tokens = await this.request(
      { type: 'measure', prompt, schema },
      AbortSignal.timeout(10_000),
    );
    if (typeof tokens !== 'number' || !Number.isSafeInteger(tokens) || tokens < 1) {
      throw new Error('The phone model did not measure its input.');
    }
    return tokens;
  }

  async ask(prompt: string, schema: object, signal: AbortSignal): Promise<string> {
    const reply = await this.request({ type: 'ask', prompt, schema }, signal);
    if (typeof reply !== 'string' || reply.length > 65_536) {
      throw new Error('The phone model returned an invalid response.');
    }
    return reply;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.worker.terminate();
    for (const finish of this.pending.values()) {
      finish(undefined, new Error('The phone model session closed.'));
    }
  }

  private async request(message: object, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted();
    if (this.destroyed) throw new Error('The phone model session closed.');
    const id = ++this.sequence;
    return await new Promise((resolve, reject) => {
      const abort = () => {
        // Hints to the running worker so it can release inference resources.
        finish(undefined, new DOMException('Model request aborted.', 'AbortError'));
        this.worker.postMessage({ type: 'abort', id });
      };
      const finish = (value: unknown, error?: Error) => {
        this.pending.delete(id);
        signal?.removeEventListener('abort', abort);
        if (error) reject(error);
        else resolve(value);
      };
      this.pending.set(id, finish);
      signal?.addEventListener('abort', abort, { once: true });
      try {
        this.worker.postMessage({ ...message, id });
      } catch (error) {
        finish(undefined, error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}
