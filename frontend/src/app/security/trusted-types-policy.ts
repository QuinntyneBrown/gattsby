import { ALLOWED_SCRIPT_PATHS, isAllowedScriptUrl } from './script-url-allowlist';

// Gattsby's one Trusted Types policy, `gattsby` (render-untrusted-text design). It creates script
// URLs on the allowlist only, and no HTML or script, so no Gattsby code can turn a string into
// markup or code. Installed before the app starts; the Content Security Policy
// (`trusted-types angular gattsby`) refuses any other policy name and any second `gattsby`.

interface TrustedTypesFactory {
  createPolicy(
    name: string,
    rules: { createScriptURL: (input: string) => string },
  ): { createScriptURL(input: string): unknown };
}

export function installTrustedTypesPolicy(
  scope: { trustedTypes?: TrustedTypesFactory; location: { origin: string } } = globalThis as never,
): string {
  const [workerPath] = ALLOWED_SCRIPT_PATHS;
  const policy = scope.trustedTypes?.createPolicy('gattsby', {
    createScriptURL: (input) => {
      if (!isAllowedScriptUrl(input, scope.location.origin)) {
        throw new TypeError(`Gattsby does not load scripts from ${input}.`);
      }
      return input;
    },
  });
  // Angular forwards this argument to ServiceWorkerContainer.register. The type assertion
  // preserves the TrustedScriptURL object across Angular's string-typed provider boundary.
  return (policy?.createScriptURL(workerPath) ?? workerPath) as string;
}
