# Feature: Scaffold the app

Journey 1 of 20 in `docs/journeys.md` (estimated 5 days).

## Goal

Create the Angular workspace in `frontend/` and everything every later journey builds on: the
app shell with lazy routes, the self-hosted fonts and tokens from the mocks, Prettier and lint, a
GitHub Actions pipeline, and Playwright (Chromium only) with the fake Bluetooth and fake model
fixtures and their guards. Today the repository holds only docs: there is no `frontend/`, no
`docs/adr/`, no `docs/design-system/`, no `.github/workflows/` and no `docs/lessons-learned.md`.

The person sees the app open in Chrome with the shell drawn as in the mocks, and an unknown address
shows the Not found page (`docs/mocks/pages/not-found/default.html`). No investigation, scan or model
call exists yet; those are journeys 2 onward. Nothing in `docs/specs/`, `docs/detailed-designs/` or
`docs/mocks/` changes in behaviour.

## Deferred (out of scope)

- The service worker, web manifest and offline behaviour (journey 17).
- Every product page other than Not found (journeys 2 onward).
- Scripted devices for drops, encryption, hostile names and a device held by another central (added by the journeys that need them).

## Finish the whole feature in one run. Do not stop. (CRITICAL)

- You are authorised to take this feature all the way: checking the requirements, design and mocks, ADR 0001 and the ADRs this journey needs, design system, incremental test-first implementation, green tests and a PR. Go through
  every phase and every slice in one continuous run. Do not pause between phases to report, ask for approval,
  or wait for "continue".
- Do not end your turn until the "Done means" list at the bottom is fully true. A partial result, a plan, or
  "the next steps would be..." is not done.
- Where the repo's instructions say "stop and ask", treat this prompt as the confirmation in advance for
  everything in scope here. Choose the simplest option that fits the existing architecture, record it (an ADR
  or the design's open-questions section, if the repo has them), and keep going.
- If a shared library, component or design asset lacks something, that is not a reason to stop. Update it
  first, as the repo's rules require, then go on.
- When a test, build or command fails, find the root cause and fix it, then go on. Never weaken a test to make
  it pass, and never skip a step quietly.
- Only stop for a real blocker you cannot resolve yourself, such as missing credentials, or an action outside
  this repo that can't be undone, such as production deploys or data changes. If that happens, finish
  everything else first, then report the blocker clearly.
- Keep track of progress (a todo list), so that nothing gets left out after context is summarised.

## Rules (read first, binding)

- Follow the repo's agent instructions exactly, especially:
  - `AGENTS.md` is the single source of rules (`CLAUDE.md` points to it). Its Safety section outranks
    every other rule, requirement and request: read-only by default, one approval per `write` or
    `control` call, the stand-clear reminder before any motion command, safe limits as data enforced
    by code, emergency stop one tap away while connected, never bypass pairing or encryption.
  - Privacy: no backend, no analytics, no request off the origin at run time; export only when the
    person starts it.
  - The model chooses; code executes and decodes. The model never decodes bytes or scores
    hypotheses. Every model action is untrusted and validated before it runs.
  - Only the BLE layer touches `navigator.bluetooth`, only the model adapter touches
    `LanguageModel`, only the store touches IndexedDB. Every browser API sits behind an adapter that
    reports availability; a missing capability degrades, never throws at the person.
  - Model output, device names and byte-derived strings are rendered as text, never as HTML.
  - Use the words in AGENTS.md "Words" and `docs/specs/` in code, docs and UI; no synonyms.
  - The mocks in `docs/mocks/` are the source of truth for the UI. When a mock changes, align the
    requirement, the ADR and the detailed design, in that order, before code.
  - One type per file. Presentation components in `frontend/src/app/ui/` take inputs, emit outputs
    and inject no app service. Logic with many cases lives in a service or pure helper with unit
    tests, never in a component. A contract refuses with an error whose `code` a screen branches on.
  - Usable one-handed: touch targets at least 48 × 48 px, every interaction by touch and keyboard,
    colour never the only carrier of a state, motion respects `prefers-reduced-motion`. Fonts and
    icons self-hosted. Routes lazy-loaded; the model adapter, analysis tools and camera imported
    dynamically; release every listener, subscription, timer, `AbortController`, model session,
    object URL and media stream.
  - Playwright: Chromium only; fixtures fake `navigator.bluetooth` and `LanguageModel`; an
    unexpected Bluetooth call, an unapproved write, a request off localhost or a page error fails the
    spec. Page objects in `frontend/e2e/pages/` own every selector. Each spec is headed with the
    requirement IDs it covers. Only behaviour specs run by default.
  - Unit tests advance a fake clock for time-driven rules; never sleep. Never write architecture
    tests (structure, layout, naming, banned-API or traceability tests).
  - CI stays green and under 5 minutes, and runs lint, the build and one critical acceptance path
    per feature. Unit tests run locally. Hardware smoke tests are for a person, never an agent.
  - Choose the platform's established best practice; a departure needs an ADR in `docs/adr/`.
  - Before the first slice, read `docs/lessons-learned.md` (if it exists) and apply what fits.
- Work through the phases below **in order**, using the repo skill each phase names.
- Copy the house style of each folder. Read the existing neighbours before you write anything new.

## Phase 1: Requirements, design and mocks agree (`engineering-requirements`, `writing-software-design-documents`, `writing-html-mocks`)

The requirement, detailed design and mocks for this journey already exist. Read them in full before
anything else, then check that they agree with each other and with `docs/application-brief.md`.

- Requirements in `docs/specs/L2.md` (and their L1 parents in `docs/specs/L1.md`): NFR-004, NFR-013 (Trusted Types policy and CSP only), NFR-014 (headers file only), NFR-021, NFR-023, NFR-026.
- Detailed designs:
  - `docs/detailed-designs/platform/simulate-devices-and-model/README.md`
  - `docs/detailed-designs/platform/serve-offline-and-private/README.md`
  - `docs/detailed-designs/platform/render-untrusted-text/README.md`
- Mocks (open them from disk; check 360, 768, 992 and 1280 px, light and dark):
  - `docs/mocks/pages/not-found/default.html`
  - `docs/mocks/assets/tokens.css`
  - `docs/mocks/assets/ui.css`
  - `docs/mocks/assets/fonts/`
  - `docs/mocks/README.md`
  - `docs/assets/` (logos)
- Only the slices of these designs that the scaffold needs are in scope: the
  fake Bluetooth API, fake model, guards and the four MVP scripted devices (simulate-devices-and-model);
  lazy routes, the headers file and the initial-bundle check (serve-offline-and-private); the
  Trusted Types policy and CSP (render-untrusted-text). Check the designs agree with the mocks and
  AGENTS.md folder tree, and fix any gap you find in the design before code.
- Where they disagree or are silent, fix the documents before any code: the mock first, then the
  requirement, then the design, as AGENTS.md "Sources of truth" orders. Use the named skill for each.
  Cross-reference the existing requirements; do not copy them.
- Resolve each `<TO SUPPLY>` this journey meets with the simplest option that fits, and record it
  in the design's open questions, or in an ADR when it is an architectural choice.
- If `docs/design-system/` lacks a token or component this journey needs, add it with the
  `extracting-design-systems` skill first.

## Phase 2: ADR 0001 and the ADRs this journey needs

- Create `docs/adr/` and write ADR 0001: the frontend stack is an Angular workspace in `frontend/`
  (AGENTS.md "Where things are"). Record the Angular version, standalone components, signals, the
  test runner for unit tests, Playwright for behaviour specs, and Chromium as the only browser.
- Write an ADR for each departure from framework best practice that this journey introduces. The
  serve-offline-and-private design already names one: the gzip initial-bundle check
  (`frontend/scripts/check-initial-bundle.ts`) beside Angular's own `budgets`.
- Resolve the `<TO SUPPLY>` items this journey meets in the three designs above (the static host
  and its headers-file format, the local static server CI uses with that file, the simulated
  chooser's layout) with the simplest option, and record each in the ADR or the design's open
  questions.

## Phase 3: Design system (`extracting-design-systems`)

- `docs/design-system/` does not exist. Extract it from `docs/mocks/` (tokens with light and dark
  themes, typography, spacing, the components the shell and Not found page use, at least) before
  building the shell, so the app's styles come from one place.
- The app's tokens and component styles follow the design system. Fonts (Geist, Geist Mono) and
  icons are copied from `docs/mocks/assets/` into `frontend/public/` and self-hosted; no CDN.

## Phase 4: Incremental implementation (`implementing-incrementally`, test-first)

- Plan thin vertical slices, for example:
  1. Workspace: create `frontend/` with the `angular-new-app` skill; Prettier and the framework's lint, with scripts in `frontend/package.json`; one smoke behaviour spec that opens `/` in Chromium.
  2. App shell: `frontend/src/app/app-shell.ts` and `app.routes.ts` with lazy `loadComponent` routes; tokens, fonts and logo from the design system; the Not found page for `/*` per `docs/mocks/pages/not-found/default.html`, light and dark.
  3. Fixtures: `frontend/e2e/fixtures/fake-bluetooth.ts`, `fake-language-model.ts` and `gattsby-test.ts`, the `BLUETOOTH` and `LANGUAGE_MODEL` injection tokens, and scripted devices in `frontend/src/simulation/devices/` (FTMS treadmill `HZN-T202-4F1A`, FTMS bike, heart-rate strap, unknown-services device). The guard fails a spec on an unexpected Bluetooth call, an unapproved write, an unexpected model call, a request off localhost, a page error or a CSP violation; prove each guard trips with a spec that expects it to.
  4. Page objects: `frontend/e2e/pages/` with one page object per screen built so far; no selector in a spec.
  5. Security: the headers file in `frontend/public/` with the CSP and Trusted Types directives from the serve-offline-and-private and render-untrusted-text designs, `frontend/src/app/security/trusted-types-policy.ts`, and `frontend/scripts/check-headers.ts` run against the locally served production build.
  6. CI: `.github/workflows/` runs Prettier check, lint, the production build, `check-initial-bundle.ts` (250 KB gzip, NFR-004), `check-headers.ts` and this journey's one critical behaviour spec, in under 5 minutes. Unit tests stay local.
  7. Docs: README "Getting started" and CONTRIBUTING "Development setup" give the prerequisites and the real commands; AGENTS.md's folder tree matches what was created; `docs/lessons-learned.md` exists with this journey's entry.
- For each slice:
  - Write the Given-When-Then criteria, taken from the acceptance criteria in `docs/specs/L2.md`.
  - Write the acceptance test: a Playwright behaviour spec in `frontend/e2e/` using page objects in
    `frontend/e2e/pages/` and the fixtures in `frontend/e2e/fixtures/`, headed with the requirement
    IDs it covers. Add unit tests (`*.spec.ts` beside the code) for logic with many cases.
  - Run it and show that it fails for the expected reason.
  - Implement the minimum that makes it pass, and refactor while the tests are green.
  - Run the regression checks (format, lint, unit tests, all behaviour specs, the production build),
    then commit.
- Add this journey's one critical acceptance path to the CI workflow in `.github/workflows/`, keeping
  the pipeline under 5 minutes.
- When all slices are green:
  - Add this journey's entry to `docs/lessons-learned.md`: what slowed it, new lessons, and how each
    earlier lesson it applied worked.
  - Set journey 1's "% complete" in `docs/journeys.md` to its true value, and update the total.
    If `docs/estimates/` exists, refresh it with the `estimating-designs` skill.
  - Keep the requirements, designs, mocks and AGENTS.md folder tree aligned with what was built.

## Done means

- `frontend/` builds and serves; `/` shows the app shell and `/anything-else` shows the Not found page, matching the mocks in light and dark at 360, 768, 992 and 1280 px.
- Every Playwright spec runs on Chromium against the fake Bluetooth API and fake model, and the guard fails a spec on each forbidden event.
- CI on GitHub Actions is green in under 5 minutes, with lint, format, build, the bundle and header checks and one critical behaviour spec.
- ADR 0001 and any other ADRs this journey needed are in `docs/adr/`; `docs/design-system/` exists.
- All the new and existing tests pass, using the scripts in `frontend/package.json`, and CI is green.
- Docs and design artifacts agree with the code: `docs/specs/`, `docs/detailed-designs/`,
  `docs/mocks/`, `docs/adr/`, `docs/lessons-learned.md` and `docs/journeys.md`.
- The work is on a branch with a PR to `main` that fills in `.github/PULL_REQUEST_TEMPLATE.md`
  (summary, requirement IDs, type of change, checklist, how it was tested, screenshots beside the
  mocks on a phone and a laptop). Fetch and rebase onto `main` first, because another session may
  have pushed to it.
- Only then end the run, with a short summary of what was built, the decisions made along the way, and
  anything deferred.
