# Feature: Confirm live metrics

Journey 3 of 20 in `docs/journeys.md` (estimated 6 days). Journeys 1 to 2 come first. Build on what they left in the repository; if one is not done, report that as a blocker rather than build it here.

## Goal

After journey 2 names a standard protocol, the investigation enters the Standard path: Gattsby
subscribes to the standard data characteristic (FTMS Treadmill Data, Indoor Bike Data, Heart Rate
Measurement), decodes it with deterministic decoders from the knowledge base, shows live metrics, and
asks the person to walk faster or pedal harder until each claimed metric is seen to move as
expected. With a metric confirmed, the verdict becomes "Connected — FTMS" or "Connected — Heart Rate"
and the Verdict page lists the confirmed readable metrics.

This journey carries the brief's MVP acceptance criteria 1 and 2 (L2 section 4). The decoders live
in `frontend/src/app/knowledge-base/decoders/`; the model never decodes bytes. Live metrics and
formatting live in `frontend/src/app/live/`.

## Deferred (out of scope)

- `compare_with_console` (TOOL-033, P2).
- Device profile export (journey 4).

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

- Requirements in `docs/specs/L2.md` (and their L1 parents in `docs/specs/L1.md`): FR-024, FR-025, FR-026, FR-027, FR-051, FR-054 (Connected verdicts), FR-057, NFR-001 (FTMS path without a model), NFR-003, TOOL-013, TOOL-015, TOOL-026, TOOL-031.
- Detailed designs:
  - `docs/detailed-designs/standard-protocol/decode-standard-data/README.md`
  - `docs/detailed-designs/standard-protocol/confirm-with-a-physical-action/README.md`
  - `docs/detailed-designs/standard-protocol/show-live-metrics/README.md`
  - `docs/detailed-designs/standard-protocol/determine-readable-metrics/README.md`
  - `docs/detailed-designs/verdict-and-profile/issue-the-verdict/README.md`
  - `docs/detailed-designs/agent/apply-heuristics-first/README.md`
- Mocks (open them from disk; check 360, 768, 992 and 1280 px, light and dark):
  - `docs/mocks/pages/investigation/identify.html`
  - `docs/mocks/pages/investigation/not-confirmed.html`
  - `docs/mocks/pages/investigation/default.html`
  - `docs/mocks/pages/verdict/default.html`
- The scripted FTMS treadmill also exposes an unknown `0xFFF0` service, which the
  apply-heuristics-first design calls ambiguous. No decider exists until journeys 6 and 7: record it
  as an observation and let it not block the Standard path verdict. State this in the design.
- Where they disagree or are silent, fix the documents before any code: the mock first, then the
  requirement, then the design, as AGENTS.md "Sources of truth" orders. Use the named skill for each.
  Cross-reference the existing requirements; do not copy them.
- Resolve each `<TO SUPPLY>` this journey meets with the simplest option that fits, and record it
  in the design's open questions, or in an ADR when it is an architectural choice.
- If `docs/design-system/` lacks a token or component this journey needs, add it with the
  `extracting-design-systems` skill first.

## Phase 2: Incremental implementation (`implementing-incrementally`, test-first)

- Plan thin vertical slices, for example:
  1. Subscribe and decode: `subscribe_and_record` and `decode_standard` for FTMS Treadmill Data; decoded values appear as live metrics (FR-024, FR-026).
  2. Confirm: `request_action` asks the person to walk faster; the decoded speed rises and is marked confirmed; a value that does not move shows the not-confirmed state (FR-025).
  3. Readable metrics: `read_supported_ranges` and the readable metrics with their decoding rules (FR-027).
  4. Verdict: "Connected — FTMS" with confirmed speed and distance on the Verdict page (FR-054 AC1, FR-057 AC1).
  5. Bike: Indoor Bike Data, confirmed by pedalling harder.
  6. Heart rate: Heart Rate Measurement, live BPM, "Connected — Heart Rate" (FR-054 AC2).
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
  - Set journey 3's "% complete" in `docs/journeys.md` to its true value, and update the total.
    If `docs/estimates/` exists, refresh it with the `estimating-designs` skill.
  - Keep the requirements, designs, mocks and AGENTS.md folder tree aligned with what was built.

## Done means

- The scripted FTMS treadmill reaches "Connected — FTMS" with speed and distance confirmed by live data; the bike and the heart-rate strap reach their Connected verdicts with live values.
- Live metrics keep up with the notification rate in NFR-003 without growing memory (NFR-005).
- The journey's critical path (MVP criterion 1) runs in CI.
- All the new and existing tests pass, using the scripts in `frontend/package.json`, and CI is green.
- Docs and design artifacts agree with the code: `docs/specs/`, `docs/detailed-designs/`,
  `docs/mocks/`, `docs/adr/`, `docs/lessons-learned.md` and `docs/journeys.md`.
- The work is on a branch with a PR to `main` that fills in `.github/PULL_REQUEST_TEMPLATE.md`
  (summary, requirement IDs, type of change, checklist, how it was tested, screenshots beside the
  mocks on a phone and a laptop). Fetch and rebase onto `main` first, because another session may
  have pushed to it.
- Only then end the run, with a short summary of what was built, the decisions made along the way, and
  anything deferred.
