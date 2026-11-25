// Checks that a running Gattsby serves the security headers of NFR-014 and NFR-013, as listed in
// the serve-offline-and-private design. CI runs it against the production build served locally by
// serve-dist.ts; a person runs it against the deployed URL after each deployment.
//
// Usage: node scripts/check-headers.ts [base URL, default http://localhost:4300/]

const base = process.argv[2] ?? 'http://localhost:4300/';
const paths = ['/', '/investigations/any-id', '/favicon.svg'];

const exactHeaders: Record<string, string> = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

const cspDirectives: Record<string, string> = {
  'default-src': "'self'",
  'script-src': "'self'",
  'style-src': "'self' 'unsafe-inline'",
  'connect-src': "'self'",
  'img-src': "'self' blob:",
  'font-src': "'self'",
  'worker-src': "'self'",
  'manifest-src': "'self'",
  'object-src': "'none'",
  'base-uri': "'self'",
  'frame-ancestors': "'none'",
  'require-trusted-types-for': "'script'",
  'trusted-types': 'angular gattsby',
};

// Only bluetooth and camera, for the app's own origin; everything listed must be denied.
const allowedFeatures: Record<string, string> = { bluetooth: '(self)', camera: '(self)' };
const deniedFeatures = ['geolocation', 'microphone', 'payment', 'usb'];

function parseDirectives(header: string, separator: string): Map<string, string> {
  return new Map(
    header
      .split(separator)
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map((part) => {
        const at = separator === ';' ? part.indexOf(' ') : part.indexOf('=');
        return at === -1
          ? [part, '']
          : [
              part.slice(0, at).trim(),
              part
                .slice(at + 1)
                .trim()
                .replace(/\s+/g, ' '),
            ];
      }),
  );
}

function check(path: string, headers: Headers): string[] {
  const problems: string[] = [];
  for (const [name, expected] of Object.entries(exactHeaders)) {
    const actual = headers.get(name);
    if (actual !== expected)
      problems.push(`${path}: ${name} is ${actual ?? 'missing'}, expected ${expected}`);
  }

  const csp = headers.get('content-security-policy');
  if (!csp) {
    problems.push(`${path}: content-security-policy is missing`);
  } else {
    const directives = parseDirectives(csp, ';');
    for (const [name, expected] of Object.entries(cspDirectives)) {
      const actual = directives.get(name);
      if (actual !== expected)
        problems.push(`${path}: CSP ${name} is ${actual ?? 'missing'}, expected ${expected}`);
    }
    for (const name of directives.keys()) {
      if (!(name in cspDirectives))
        problems.push(`${path}: CSP has an unexpected directive ${name}`);
    }
    if (/unsafe-eval/.test(csp)) problems.push(`${path}: CSP allows unsafe-eval`);
  }

  const permissions = headers.get('permissions-policy');
  if (!permissions) {
    problems.push(`${path}: permissions-policy is missing`);
  } else {
    const features = parseDirectives(permissions, ',');
    for (const [feature, allowlist] of features) {
      const expected = allowedFeatures[feature] ?? '()';
      if (allowlist !== expected)
        problems.push(`${path}: Permissions-Policy allows ${feature}=${allowlist}`);
    }
    for (const feature of [...Object.keys(allowedFeatures), ...deniedFeatures]) {
      if (!features.has(feature))
        problems.push(`${path}: Permissions-Policy does not name ${feature}`);
    }
  }
  return problems;
}

const problems: string[] = [];
for (const path of paths) {
  const response = await fetch(new URL(path, base), { redirect: 'manual' });
  if (response.status !== 200) problems.push(`${path}: status ${response.status}`);
  problems.push(...check(path, response.headers));
}

if (problems.length > 0) {
  console.error(`Security headers at ${base} do not match NFR-013 and NFR-014:`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}
console.log(`Security headers at ${base} match NFR-013 and NFR-014 on ${paths.length} paths.`);
