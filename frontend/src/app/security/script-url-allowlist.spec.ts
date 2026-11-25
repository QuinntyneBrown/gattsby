import { isAllowedScriptUrl } from './script-url-allowlist';

describe('isAllowedScriptUrl', () => {
  const origin = 'https://gattsby.example';

  it.each([['/ngsw-worker.js'], ['ngsw-worker.js'], ['https://gattsby.example/ngsw-worker.js']])(
    'accepts the service worker script %s on the own origin',
    (url) => {
      expect(isAllowedScriptUrl(url, origin)).toBe(true);
    },
  );

  it.each([
    ['https://evil.example/ngsw-worker.js', 'another origin'],
    ['//evil.example/ngsw-worker.js', 'a protocol-relative URL to another origin'],
    ['http://gattsby.example/ngsw-worker.js', 'another scheme'],
    ['/main.js', 'a script not on the allowlist'],
    ['/ngsw-worker.js?x=1', 'a query'],
    ['/ngsw-worker.js#x', 'a fragment'],
    ['javascript:alert(1)', 'a javascript: URL'],
    ['data:text/javascript,alert(1)', 'a data: URL'],
    ['blob:https://gattsby.example/1234', 'a blob: URL'],
    ['/a/../ngsw-worker.js/..', 'a path that leaves the allowlist after normalising'],
  ])('refuses %s (%s)', (url) => {
    expect(isAllowedScriptUrl(url, origin)).toBe(false);
  });
});
