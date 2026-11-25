# ADR 0002: Check the initial bundle compressed, beside Angular's budgets

- **Status:** Accepted
- **Date:** 2026-11-25
- **Requirements:** NFR-004 (A-08)

## Context

NFR-004 caps the initial bundle (the JavaScript and CSS loaded before the Home page is interactive)
at 250 KB **compressed**, and its acceptance criterion asks the build to fail above it. Angular's
own `budgets` in `angular.json` are the framework's best practice for bundle limits, but they
measure **uncompressed** bytes. The CLI prints an "estimated transfer size", but a budget cannot be
set on it. A budget on raw bytes either lets a compressed overrun through or fails builds that are
well within the compressed limit.

## Decision

- Keep Angular's `budgets` in the production configuration as an early warning on raw size
  (initial: warning at 600 kB, error at 900 kB raw; component styles: warning at 4 kB, error at
  8 kB).
- Add `frontend/scripts/check-initial-bundle.ts`, run after the production build (`npm run
  check:bundle`, and in CI). It reads `index.html` in the build output, takes every script and
  stylesheet it loads directly (the initial chunks; lazy chunks are loaded later by `import()`),
  plus each initial chunk's static `import` of another chunk, compresses each file with gzip at
  level 9, and fails with a non-zero exit code when the total exceeds 250 KB (256 000 bytes), naming
  each file and its compressed size.
- Gzip is the measure because every static host serves it; a host that serves Brotli only does
  better.

## Consequences

- The build fails exactly where NFR-004 says it should, and the report names the chunk to look at.
- Two limits now exist; the compressed one is binding, the raw one is a warning that may be
  adjusted freely.
- The check depends on Angular's output layout (`dist/frontend/browser/index.html`); a change in
  the builder's output path changes one constant in the script.
