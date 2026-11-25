# Feature: Export the device profile

Journey 4 of 20 in `docs/journeys.md` (estimated 3 days). Journeys 1 to 3 come first. Build on what they left in the repository; if one is not done, report that as a blocker rather than build it here.

## Goal

When an investigation reaches its verdict, Gattsby builds the device profile and saves it on
the device. From the Verdict page the person opens the Device profile page (`/profiles/:id`) and
exports the profile, or the full investigation record, as versioned JSON that validates against the
published schemas in `frontend/src/schemas/`. The person can also label the location of the
investigation (for example "Decathlon, Lille"), which the profile carries. Export is the only way
data leaves the device, and the person starts it.

This journey carries half of the brief's MVP acceptance criterion 6 (export); journey 16 adds the
re-import.

## Deferred (out of scope)

- Import (journey 16).
- The Saved devices list (journey 15).
- Public sharing (FR-075, Later).

## Finish the whole feature in one run. Do not stop. (CRITICAL)

- You are authorised to take this feature all the way: checking the requirements, design and mocks, incremental test-first implementation, green tests and a PR. Go through
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

- Requirements in `docs/specs/L2.md` (and their L1 parents in `docs/specs/L1.md`): FR-010, FR-055, FR-062, FR-063, NFR-012 (export only on the person's request), NFR-013, NFR-024.
- Detailed designs:
  - `docs/detailed-designs/verdict-and-profile/build-the-device-profile/README.md`
  - `docs/detailed-designs/persistence/export-profiles-and-records/README.md`
  - `docs/detailed-designs/investigation/start-an-investigation/README.md`
- Mocks (open them from disk; check 360, 768, 992 and 1280 px, light and dark):
  - `docs/mocks/pages/device-profile/default.html`
  - `docs/mocks/pages/device-profile/loading.html`
  - `docs/mocks/pages/device-profile/error.html`
  - `docs/mocks/pages/device-profile/success.html`
  - `docs/mocks/pages/device-profile/partial.html`
  - `docs/mocks/pages/verdict/default.html`
  - `docs/mocks/dialogs/export/default.html`
  - `docs/mocks/dialogs/export/busy.html`
  - `docs/mocks/dialogs/export/success.html`
  - `docs/mocks/dialogs/add-note/default.html`
  - `docs/mocks/dialogs/add-note/invalid.html`
  - `docs/mocks/dialogs/investigation-menu/default.html`
  - `docs/mocks/notifications/toast/success.html`
  - `docs/mocks/notifications/toast/danger.html`
- OQ-09 (which fields the owner's apps need, and whether to follow an existing
  schema) is open; follow FR-055's field list and record the choice. Every metric and feature in a
  profile carries an evidence reference (FR-055 AC2); the Evidence page that opens them is journey 14.
- Where they disagree or are silent, fix the documents before any code: the mock first, then the
  requirement, then the design, as AGENTS.md "Sources of truth" orders. Use the named skill for each.
  Cross-reference the existing requirements; do not copy them.
- Resolve each `<TO SUPPLY>` this journey meets with the simplest option that fits, and record it
  in the design's open questions, or in an ADR when it is an architectural choice.
- If `docs/design-system/` lacks a token or component this journey needs, add it with the
  `extracting-design-systems` skill first.

## Phase 2: Incremental implementation (`implementing-incrementally`, test-first)

- Plan thin vertical slices, for example:
  1. Build: `ProfileBuilder` produces a profile from a finished investigation; it validates against the profile JSON Schema (FR-055 AC1) and is saved.
  2. Device profile page: `/profiles/:id` in its default, loading, error and partial states.
  3. Export profile: the Export dialog writes a versioned JSON file with a safe file name (FR-062, NFR-024).
  4. Export record: the full investigation record, raw log included, as versioned JSON (FR-063).
  5. Location label: the Add note dialog from the investigation menu sets the label, validated, and the profile carries it (FR-010).
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
  - Set journey 4's "% complete" in `docs/journeys.md` to its true value, and update the total.
    If `docs/estimates/` exists, refresh it with the `estimating-designs` skill.
  - Keep the requirements, designs, mocks and AGENTS.md folder tree aligned with what was built.

## Done means

- A finished FTMS investigation's profile validates against the schema and exports as JSON from the Verdict and Device profile pages; the full record exports too.
- No file is written without the person's tap, and no request leaves the origin.
- All the new and existing tests pass, using the scripts in `frontend/package.json`, and CI is green.
- Docs and design artifacts agree with the code: `docs/specs/`, `docs/detailed-designs/`,
  `docs/mocks/`, `docs/adr/`, `docs/lessons-learned.md` and `docs/journeys.md`.
- The work is on a branch with a PR to `main` that fills in `.github/PULL_REQUEST_TEMPLATE.md`
  (summary, requirement IDs, type of change, checklist, how it was tested, screenshots beside the
  mocks on a phone and a laptop). Fetch and rebase onto `main` first, because another session may
  have pushed to it.
- Only then end the run, with a short summary of what was built, the decisions made along the way, and
  anything deferred.
