// The script URLs Gattsby's Trusted Types policy accepts (render-untrusted-text design): the
// service worker script, on the app's own origin, and nothing else.
export const ALLOWED_SCRIPT_PATHS: readonly string[] = ['/ngsw-worker.js'];

export function isAllowedScriptUrl(url: string, origin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url, origin);
  } catch {
    return false;
  }
  return (
    parsed.origin === origin &&
    parsed.search === '' &&
    parsed.hash === '' &&
    ALLOWED_SCRIPT_PATHS.includes(parsed.pathname)
  );
}
