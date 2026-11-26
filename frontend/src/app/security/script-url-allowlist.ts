// The script URLs Gattsby's Trusted Types policy accepts (render-untrusted-text design): the
// service worker and the phone model worker, on the app's own origin.
export const SERVICE_WORKER_SCRIPT = '/ngsw-worker.js';
export const PHONE_MODEL_WORKER_SCRIPT = '/phone-model/worker.js';
const ALLOWED_SCRIPT_PATHS: readonly string[] = [SERVICE_WORKER_SCRIPT, PHONE_MODEL_WORKER_SCRIPT];

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
