# Lessons learned

One entry per journey or slice, newest last. Read it before starting a slice and apply what fits
(AGENTS.md "Lessons learned"); when the slice finishes, add its entry before it merges.

## Journey 1: Scaffold the app (2026-11-25)

### What slowed it

- **The journey prompt was older than the repository.** It said `docs/design-system/` did not
  exist and that the fonts were in `docs/mocks/assets/fonts/`; both had moved on (the design system
  exists and holds the fonts). Checking the tree before acting avoided re-extracting the design
  system.
- **Angular swallows uncaught errors.** `provideBrowserGlobalErrorListeners()` calls
  `preventDefault()` on every `error` and `unhandledrejection` event and logs them with
  `console.error`, so Playwright's `pageerror` never fires in the app. The page-error guard now also
  fails a spec on any console error.
- **`base-uri 'none'` breaks Angular.** The router needs `<base href="/">`; the design's hardening
  value blocked it. The design, the headers file and ADR 0001 now say `base-uri 'self'`.
- **Chrome exempts DevTools-run code from the CSP's eval check.** `new Function` called directly
  inside `page.evaluate` runs even under `script-src 'self'`. A probe that must be refused runs from
  a task the page schedules (a `MessageChannel` message).
- **Critical-CSS inlining adds an inline `onload` handler**, which `script-src 'self'` refuses. It
  is turned off in the production build (ADR 0001).

### New lessons

1. Read the tree before trusting a prompt's description of it; prompts age faster than code.
2. Turn the Content Security Policy on early. Every spec ran under it from slice 5, and it found
   the `base-uri` conflict at once; a policy added late finds many such conflicts together.
3. Prove each guard with a spec that makes it trip and acknowledges the violation, plus one spec
   (`test.fail`) that proves an unacknowledged violation fails the spec at teardown.
4. Write the behaviour spec before touching the build configuration. The theme and font specs of
   slice 2 passed on their first run, because the design-system styles had already been wired into
   `angular.json` while checking that the build could read them; their red step was missed.
5. Read the design system's CSS from `docs/design-system/` in `angular.json` rather than copying
   it; the build bundles the fonts it references, so the app and the mocks cannot drift. The Not
   found page then matched its mock pixel for pixel, apart from the deferred import action.
6. Pin `@playwright/test` to the version whose Chromium the environment already has; a mismatch
   needs a browser download.

### Earlier lessons applied

None; this is the first entry.
