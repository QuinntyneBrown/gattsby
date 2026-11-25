# Feature: Identify a standard machine

Journey 2 of 20 in `docs/journeys.md` (estimated 10 days). Journey 1 comes first. Build on what it left in the repository; if it is not done, report that as a blocker rather than build it here.

## Goal

The person starts an investigation from the Home page, answers the Prepare questions, taps
"Find the device", picks the machine in Chrome's chooser, and watches Gattsby connect, list the GATT
layout, read Device Information and match the known profiles, until the hypothesis names the protocol
(for example "Standard fitness machine (FTMS)" or "Heart Rate") with its confidence and evidence.
The investigation is saved as it runs and ends with one verdict on the Verdict page.

This journey builds the shared core every later journey uses: the BLE layer
(`frontend/src/app/ble/`) with its raw traffic log, the knowledge base (`frontend/src/knowledge-base/`
data and `frontend/src/app/knowledge-base/` loader and matcher), the investigation store
(`frontend/src/app/store/`), the tool registry and result envelope (`frontend/src/app/tools/`), and
the playbook orchestrator in `frontend/src/app/agent/` with the Prepare, Find, Identify and Conclude
stages decided by the deterministic playbook rules (FR-046). The model (journey 6) and checklist
mode (journey 7) plug in later through the `Decider` seam; this journey does not build either.
The scripted devices are the FTMS treadmill, FTMS bike and heart-rate strap from journey 1.

FR-054 is binding: "Connected — *protocol*" needs at least one metric confirmed by live data, which
is journey 3. Until then the Standard path stage does not exist, and the verdict this journey issues
must be the one FR-054 allows for an identified but unconfirmed protocol. Record the choice in the
issue-the-verdict design's open questions.

## Deferred (out of scope)

- Live data, confirmation and the "Connected — *protocol*" verdict (journey 3).
- Device profile and export (journey 4); location label (journey 4).
- The Readiness page (journey 5), the model (journey 6), checklist mode (journey 7).
- Several look-alike candidates and power-cycle matching (journey 9).

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

- Requirements in `docs/specs/L2.md` (and their L1 parents in `docs/specs/L1.md`): FR-007, FR-008, FR-011, FR-012, FR-015, FR-017, FR-018, FR-019, FR-020, FR-021, FR-023, FR-045 (stage end and step budget), FR-046 (decided steps), FR-048, FR-050, FR-051, FR-052, FR-053, FR-054, FR-057, FR-060, FR-066, FR-067, FR-069, FR-070, FR-072, FR-073, NFR-003, NFR-005, NFR-009, NFR-010, NFR-011, NFR-013, NFR-016, TOOL-001, TOOL-002, TOOL-003, TOOL-006, TOOL-008, TOOL-009, TOOL-010, TOOL-011, TOOL-012, TOOL-025, TOOL-026, TOOL-028, TOOL-030.
- Detailed designs:
  - `docs/detailed-designs/investigation/start-an-investigation/README.md`
  - `docs/detailed-designs/investigation/ask-the-person/README.md`
  - `docs/detailed-designs/investigation/follow-the-investigation/README.md`
  - `docs/detailed-designs/discovery/scan-for-the-device/README.md`
  - `docs/detailed-designs/connection/connect-to-the-device/README.md`
  - `docs/detailed-designs/connection/log-raw-traffic/README.md`
  - `docs/detailed-designs/connection/release-the-connection/README.md`
  - `docs/detailed-designs/identification/enumerate-the-gatt-layout/README.md`
  - `docs/detailed-designs/identification/read-device-information/README.md`
  - `docs/detailed-designs/identification/match-known-profiles/README.md`
  - `docs/detailed-designs/knowledge-base/maintain-the-knowledge-base/README.md`
  - `docs/detailed-designs/tool-registry/register-and-list-tools/README.md`
  - `docs/detailed-designs/tool-registry/return-a-result-envelope/README.md`
  - `docs/detailed-designs/persistence/save-as-the-investigation-runs/README.md`
  - `docs/detailed-designs/verdict-and-profile/track-the-hypothesis/README.md`
  - `docs/detailed-designs/verdict-and-profile/issue-the-verdict/README.md`
  - `docs/detailed-designs/agent/apply-heuristics-first/README.md`
  - `docs/detailed-designs/agent/end-the-loop/README.md`
  - `docs/detailed-designs/environment/check-capabilities/README.md`
  - `docs/detailed-designs/platform/render-untrusted-text/README.md`
- Mocks (open them from disk; check 360, 768, 992 and 1280 px, light and dark):
  - `docs/mocks/pages/home/default.html`
  - `docs/mocks/pages/home/empty.html`
  - `docs/mocks/pages/home/loading.html`
  - `docs/mocks/pages/home/error.html`
  - `docs/mocks/pages/investigation/prepare.html`
  - `docs/mocks/pages/investigation/find.html`
  - `docs/mocks/pages/investigation/find-cancelled.html`
  - `docs/mocks/pages/investigation/identify.html`
  - `docs/mocks/pages/investigation/held-by-other.html`
  - `docs/mocks/pages/investigation/loading.html`
  - `docs/mocks/pages/investigation/error.html`
  - `docs/mocks/pages/verdict/default.html`
  - `docs/mocks/pages/verdict/loading.html`
  - `docs/mocks/pages/verdict/error.html`
- The `check_capabilities` tool and its detector are built here because the
  Prepare stage calls them; the Readiness page that shows them is journey 5. The Home page sections
  for the paused investigation, history, saved devices and missing tools are journeys 11, 15 and 14;
  build only what starting an investigation needs and leave those sections out until their journey.
- Where they disagree or are silent, fix the documents before any code: the mock first, then the
  requirement, then the design, as AGENTS.md "Sources of truth" orders. Use the named skill for each.
  Cross-reference the existing requirements; do not copy them.
- Resolve each `<TO SUPPLY>` this journey meets with the simplest option that fits, and record it
  in the design's open questions, or in an ADR when it is an architectural choice.
- If `docs/design-system/` lacks a token or component this journey needs, add it with the
  `extracting-design-systems` skill first.

## Phase 2: Incremental implementation (`implementing-incrementally`, test-first)

- Plan thin vertical slices, for example:
  1. Start: Home page (empty and default) with "New investigation"; the store creates the investigation (FR-007) and the Investigation page opens at `/investigations/:id` in the Prepare stage.
  2. Prepare: machine type and brand questions with suggested answers, "Don't know" and skip (FR-008, FR-050, FR-052), and the power-on and disconnect request (FR-051), each step committed to IndexedDB as it runs (FR-060).
  3. Find: `scan_devices` with the known-UUID filters from the knowledge base (FR-011, FR-067), widening to `scan_all_devices` when nothing is chosen (FR-012); the person's tap opens the chooser; cancel shows the find-cancelled state.
  4. Connect: `connect`, the connection banner's success, and the held-by-other state when the scripted device refuses (FR-015, FR-017; add that scripted device).
  5. Identify: `enumerate_gatt`, `read_characteristic`, `read_device_info` and `match_known_profiles`; services the browser cannot see are reported (FR-019, FR-020, FR-021, FR-023); every packet goes to the bounded raw traffic log (FR-073, NFR-003, NFR-005).
  6. Hypothesis: the hypothesis panel updates after each observation with confidence and evidence, computed by deterministic code (FR-053, TOOL-028).
  7. Conclude: `finish`, one verdict per FR-054 and the Verdict page (FR-057), the connection released (FR-018), for the FTMS treadmill, the FTMS bike and the heart-rate strap.
  8. Untrusted text: a device whose name holds markup is shown as text (NFR-013); add the hostile-name scripted device.
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
  - Set journey 2's "% complete" in `docs/journeys.md` to its true value, and update the total.
    If `docs/estimates/` exists, refresh it with the `estimating-designs` skill.
  - Keep the requirements, designs, mocks and AGENTS.md folder tree aligned with what was built.

## Done means

- From the Home page, an investigation of the scripted FTMS treadmill, FTMS bike and heart-rate strap each runs Prepare, Find and Identify and names the protocol with confidence and evidence, then ends with one FR-054 verdict on the Verdict page.
- Every step is committed to IndexedDB as it happens; reopening the investigation shows the steps so far.
- No model call is made in any of these runs; the guard proves it.
- All the new and existing tests pass, using the scripts in `frontend/package.json`, and CI is green.
- Docs and design artifacts agree with the code: `docs/specs/`, `docs/detailed-designs/`,
  `docs/mocks/`, `docs/adr/`, `docs/lessons-learned.md` and `docs/journeys.md`.
- The work is on a branch with a PR to `main` that fills in `.github/PULL_REQUEST_TEMPLATE.md`
  (summary, requirement IDs, type of change, checklist, how it was tested, screenshots beside the
  mocks on a phone and a laptop). Fetch and rebase onto `main` first, because another session may
  have pushed to it.
- Only then end the run, with a short summary of what was built, the decisions made along the way, and
  anything deferred.
