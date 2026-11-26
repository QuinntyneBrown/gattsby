# ADR 0003: The headers file is `public/_headers`, served locally by `serve-dist.ts`

- **Status:** Accepted
- **Date:** 2026-11-25
- **Requirements:** NFR-013, NFR-014 (A-04), NFR-023

## Context

Gattsby is static files on "any HTTPS host that can set the response headers in NFR-014" (A-04).
The serve-offline-and-private design leaves three things open: the headers file's name and format,
the HSTS `max-age`, and the local static server that CI uses to check the headers. The
render-untrusted-text design also asks that the behaviour specs run against the production build
with its Content Security Policy, so that a Trusted Types violation anywhere fails them.

## Decision

- **Format:** `frontend/public/_headers`, in the plain-text `_headers` format read by Cloudflare
  Pages and Netlify: a path pattern line (`/*`), then indented `Name: value` lines. The build copies
  it to the output root. A host that reads another format (for example `firebase.json` or an nginx
  `add_header` block) gets the same headers translated at deployment, and `check-headers.ts` is run
  against its URL afterwards.
- **HSTS:** `max-age=63072000; includeSubDomains` (two years). `preload` is not set, because
  joining the preload list is a decision for whoever owns the domain.
- **Local server:** `frontend/scripts/serve-dist.ts` serves the production build on localhost using
  only Node's built-in `http`, `fs` and `path` modules. It applies every header from `_headers` to
  every response, serves files with their content type, and answers any path without a file
  extension with `index.html`, as the static host's single-page fallback does. No dependency is
  added for it.
- **Who uses it:** Playwright's `webServer` starts it for the behaviour specs, so every spec runs
  under the deployed Content Security Policy; `check-headers.ts` fetches from it in CI. A person runs
  `check-headers.ts` against the deployed URL after each deployment (NFR-014).
- The development server (`ng serve`) does not apply the headers; it is for building screens, not
  for proving security.
- The phone model deployment contract uses the exact same-origin script path
  `/phone-model/worker.js`. It is the only addition to the existing Trusted Types script URL
  allowlist. The app ships a disabled manifest until the owner selects a runtime and model under
  FR-074. The current directives also apply to the worker.

## Consequences

- The behaviour specs prove NFR-013 AC2 (no Trusted Types violation) on every run, at the cost of a
  production build before the specs (about 5 seconds).
- The `_headers` parser in `serve-dist.ts` reads only what Gattsby's file uses: one or more path
  blocks of `Name: value` lines. A richer rule (splats, placeholders, `!` removal) would need the
  parser extended.
- Moving to a host with another format means translating one file and re-running the check, not
  changing the app.
