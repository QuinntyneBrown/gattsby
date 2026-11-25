// Requirements: NFR-013, NFR-014
// The production build is served with its Content Security Policy, so Trusted Types refuse any
// string at an HTML or script sink, and only Gattsby's own policies may exist.

import { expect, test } from './fixtures/gattsby-test';
import { Misbehaviour } from './fixtures/misbehaviour';
import { HomePage } from './pages/home.page';

test.describe('Security', () => {
  test('Given the Content Security Policy, when a string reaches an HTML sink, then Trusted Types refuse it', async ({
    page,
    guards,
  }) => {
    await new HomePage(page).goto();

    const refused = await new Misbehaviour(page).assignInnerHtml('<img src=x onerror=alert(1)>');

    expect(refused).toBe(true);
    await expect.poll(() => guards.kinds()).toContain('csp-violation');
    guards.acknowledge('csp-violation');
    guards.acknowledge('page-error'); // Chrome logs the refusal as a console error too.
  });

  test('Given the Content Security Policy, when code creates a Trusted Types policy of its own, then the browser refuses it', async ({
    page,
    guards,
  }) => {
    await new HomePage(page).goto();

    const refused = await new Misbehaviour(page).createTrustedTypesPolicy('lenient');

    expect(refused).toBe(true);
    await expect.poll(() => guards.kinds()).toContain('csp-violation');
    guards.acknowledge('csp-violation');
    guards.acknowledge('page-error');
  });

  test('Given the Content Security Policy, when code evaluates a string, then the browser refuses it', async ({
    page,
    guards,
  }) => {
    await new HomePage(page).goto();

    const refused = await new Misbehaviour(page).evaluateString('1 + 1');

    expect(refused).toBe(true);
    await expect.poll(() => guards.kinds()).toContain('csp-violation');
    guards.acknowledge('csp-violation');
    guards.acknowledge('page-error');
  });

  test("Given the app has started, when code creates a second policy named gattsby, then the browser refuses it because Gattsby's own holds the name", async ({
    page,
    guards,
  }) => {
    await new HomePage(page).goto();

    const refused = await new Misbehaviour(page).createTrustedTypesPolicy('gattsby');

    expect(refused).toBe(true);
    await expect.poll(() => guards.kinds()).toContain('csp-violation');
    guards.acknowledge('csp-violation');
    guards.acknowledge('page-error');
  });
});
