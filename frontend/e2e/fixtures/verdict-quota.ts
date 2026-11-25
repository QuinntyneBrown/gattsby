import type { Page } from '@playwright/test';

// Refuse one real IndexedDB transaction at the same point as a quota failure.
export async function refuseNextVerdictCommit(page: Page): Promise<void> {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (value: unknown, key?: IDBValidKey) {
      const request = original.call(this, value, key);
      if (this.name === 'profiles') {
        IDBObjectStore.prototype.add = original;
        Object.defineProperty(this.transaction, 'error', {
          value: new DOMException('Test quota exhausted', 'QuotaExceededError'),
        });
        queueMicrotask(() => this.transaction.abort());
      }
      return request;
    };
  });
}
