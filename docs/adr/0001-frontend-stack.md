# ADR 0001: The frontend stack is an Angular workspace in `frontend/`

- **Status:** Accepted
- **Date:** 2026-11-25
- **Requirements:** NFR-004, NFR-013, NFR-014, NFR-021, NFR-023, NFR-026

## Context

Gattsby is a static, client-only single-page app for Chrome (AGENTS.md "Purpose"). AGENTS.md names
an Angular workspace in `frontend/` as the default stack, matching the owner's other apps and the
`angular-developer` and `angular-new-app` skills in this repository, and asks this ADR to record
the choice when the workspace is created. The detailed designs already name Angular building
blocks (`loadComponent` routes, injection tokens, `SwUpdate`).

The choice also has to settle four things the designs left open: the unit-test runner, the lint
rules that keep untrusted text inert (render-untrusted-text design), how component styles meet the
Content Security Policy (serve-offline-and-private design), and the file names of pages,
components and dialogs.

## Decision

- **Angular 22.3** (the current major when the workspace was created), generated with
  `ng new frontend --style=css --routing --ssr=false --prefix=g --zoneless`.
  - **Standalone components** only, with `ChangeDetectionStrategy.OnPush`; no NgModules.
  - **Signals** for state (`signal`, `computed`, `input`, `output`); RxJS only where an Angular API
    hands one over.
  - **Zoneless** change detection (Angular's default from v21).
  - **No server-side rendering**: Gattsby is static files (AGENTS.md "Where things are").
  - **Lazy routes** with `loadComponent` for every page (NFR-004).
- **Unit tests:** Vitest through Angular's `@angular/build:unit-test` builder, on jsdom. They sit
  beside the code as `*.spec.ts` and run locally with `npm test`. Time-driven rules use Vitest's
  fake timers; nothing sleeps.
- **Behaviour specs:** Playwright (`@playwright/test`, pinned to an exact version) in
  `frontend/e2e/`, **Chromium only**, against the production build served with its headers file
  (ADR 0003), with the fake Bluetooth API, the fake model and the guards of the
  simulate-devices-and-model design.
- **Formatting and lint:** Prettier (`printWidth` 100, single quotes, the Angular parser for
  templates) and ESLint through `angular-eslint`, with `eslint-config-prettier` so the two never
  disagree. CI fails on either.
- **Lint rules that keep untrusted text inert** (render-untrusted-text design, NFR-013):
  - TypeScript: `no-eval`, `no-implied-eval`, `no-new-func`; `no-restricted-syntax` on assignments
    to `innerHTML` or `outerHTML` and on calls to `bypassSecurityTrust*`.
  - Templates: `no-restricted-syntax` on `BoundAttribute` nodes named `innerHTML` or `outerHTML`.
- **Styles and the Content Security Policy:** Angular inserts each component's styles as a
  `<style>` element at run time. A static host cannot issue a per-response nonce, so the policy
  allows `style-src 'self' 'unsafe-inline'`. Scripts stay `script-src 'self'` with no
  `'unsafe-inline'` or `'unsafe-eval'`, as NFR-014 requires. Angular's critical-CSS inlining is
  turned off (`optimization.styles.inlineCritical: false`), because it adds an inline `onload`
  handler that `script-src 'self'` refuses.
- **`base-uri 'self'`, not `'none'`:** Angular's router resolves routes and lazy chunks against
  `<base href="/">`, which `base-uri 'none'` blocks. `'self'` still stops a `<base>` that points
  off the app's origin.
- **Styles come from the design system.** `docs/design-system/` is the source of the tokens and the
  component classes; the build reads `docs/design-system/tokens/tokens.css` and
  `docs/design-system/assets/components.css` directly (the `styles` of `angular.json`), so the app
  and the mocks never drift. The tokens' `@font-face` rules point at the Geist and Geist Mono files
  in `docs/design-system/assets/fonts/`; the build copies them, hashed, into its `media/` folder,
  so the fonts are self-hosted from the app's own origin without a second copy in the repository.
- **File names** follow the detailed designs: `*.page.ts` for pages, `*.component.ts` for
  presentation components, `*.dialog.ts` for dialogs and plain names for services, helpers and
  tokens. Angular's style guide (v20) drops these suffixes but asks for consistency within a
  project; the designs, written first, already use them across every subsystem.
- **Build scripts** in `frontend/scripts/` are TypeScript run by Node 22 directly (type stripping,
  on by default from Node 22.18), so they need no extra runner.

## Consequences

- Every later journey builds on standalone components, signals and lazy routes; the designs' class
  and file names map one-to-one onto the code.
- `'unsafe-inline'` for styles is a small, recorded weakening: a style injection cannot run script,
  and Trusted Types still guard every script and HTML sink. If Angular gains hash-based style CSP
  for static hosts, this ADR is revisited.
- Turning off critical-CSS inlining costs a render-blocking stylesheet request on first load; the
  initial-bundle check (ADR 0002) still bounds its size.
- Playwright's pinned version must match the Chromium build CI installs; upgrading it is a one-line
  change in `frontend/package.json` and the CI cache key.
