# Feature: Test one control command

Journey 8 of 20 in `docs/journeys.md` (estimated 8 days). Journeys 1 to 7 come first. Build on what they left in the repository; if one is not done, report that as a blocker rather than build it here.

## Goal

When the device has a control point (FTMS Control Point on the scripted treadmill), the
Control stage asks the person's approval to request control, then to send one low-risk command (for
example set target speed 6.0 to 5.9 km/h, `02 4E 02`), reminds them to stand clear and know where the
machine's own stop is before any motion command, asks them to confirm the effect, and then stops
(`08 01`). Every `write` or `control` call needs its own approval at that moment. Values outside the
knowledge base's safe limits are refused by code. The emergency stop is one tap away on every screen
while a device is connected; it sends stop or reset, refuses every later write and stops the loop.

This journey carries the brief's MVP acceptance criterion 5: no control command is sent without the
person's explicit approval. The safety rules in AGENTS.md outrank every other rule.

## Deferred (out of scope)

- Vendor handshakes (journey 18).

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

- Requirements in `docs/specs/L2.md` (and their L1 parents in `docs/specs/L1.md`): FR-034, FR-035, FR-036, FR-037, FR-038, FR-039, FR-040, NFR-018, NFR-019, TOOL-021, TOOL-022, TOOL-024.
- Detailed designs:
  - `docs/detailed-designs/device-control/approve-a-command/README.md`
  - `docs/detailed-designs/device-control/request-control/README.md`
  - `docs/detailed-designs/device-control/test-one-command/README.md`
  - `docs/detailed-designs/device-control/keep-commands-conservative/README.md`
  - `docs/detailed-designs/device-control/emergency-stop/README.md`
- Mocks (open them from disk; check 360, 768, 992 and 1280 px, light and dark):
  - `docs/mocks/pages/investigation/control.html`
  - `docs/mocks/pages/investigation/control-check.html`
  - `docs/mocks/dialogs/approval/default.html`
  - `docs/mocks/dialogs/approval/busy.html`
  - `docs/mocks/dialogs/approval/confirmed.html`
  - `docs/mocks/dialogs/approval/failed.html`
  - `docs/mocks/dialogs/approval/stop.html`
  - `docs/mocks/dialogs/emergency-stop/default.html`
  - `docs/mocks/dialogs/emergency-stop/busy.html`
  - `docs/mocks/dialogs/emergency-stop/failed.html`
  - `docs/mocks/dialogs/unexpected-effect/default.html`
  - `docs/mocks/pages/device-profile/default.html`
- OQ-07 (safe limits per device type), OQ-08 (Control stage in a store) and OQ-12
  (stand-clear check for `request_control`) are open. Take the most conservative reading: the
  smallest change, limits as data in `frontend/src/knowledge-base/limits/` and enforced in code, and
  the approval for `request_control` without the stand-clear check as OQ-12 states. Record each choice.
- Where they disagree or are silent, fix the documents before any code: the mock first, then the
  requirement, then the design, as AGENTS.md "Sources of truth" orders. Use the named skill for each.
  Cross-reference the existing requirements; do not copy them.
- Resolve each `<TO SUPPLY>` this journey meets with the simplest option that fits, and record it
  in the design's open questions, or in an ADR when it is an architectural choice.
- If `docs/design-system/` lacks a token or component this journey needs, add it with the
  `extracting-design-systems` skill first.

## Phase 2: Incremental implementation (`implementing-incrementally`, test-first)

- Plan thin vertical slices, for example:
  1. Approval gate: no `write` or `control` call reaches the BLE layer without an approval for that call; the guard fails on any unapproved write (FR-034, NFR-018).
  2. Request control: approve, send, report the result (FR-037, TOOL-021).
  3. Stand clear: the reminder before every motion command (FR-035).
  4. Safe limits: a value outside the limits is refused before the dialog opens (FR-036, NFR-019).
  5. Test one command: send, ask the person to confirm the effect, then stop; an unexpected effect opens its dialog (FR-038, TOOL-022).
  6. Emergency stop: on every screen while connected; it sends stop, refuses later writes and ends the loop, including the not-acknowledged path (FR-039, TOOL-024).
  7. Controllable features: shown on the Verdict and Device profile pages (FR-040).
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
  - Set journey 8's "% complete" in `docs/journeys.md` to its true value, and update the total.
    If `docs/estimates/` exists, refresh it with the `estimating-designs` skill.
  - Keep the requirements, designs, mocks and AGENTS.md folder tree aligned with what was built.

## Done means

- No write or control call reaches the fake device without its own approval, proved by the guard and a spec for each refused path.
- The scripted treadmill's control test runs request control, one small speed change and stop, with the person confirming the effect.
- Emergency stop works from every screen while connected, and every write after it is refused.
- MVP criterion 5 runs in CI.
- All the new and existing tests pass, using the scripts in `frontend/package.json`, and CI is green.
- Docs and design artifacts agree with the code: `docs/specs/`, `docs/detailed-designs/`,
  `docs/mocks/`, `docs/adr/`, `docs/lessons-learned.md` and `docs/journeys.md`.
- The work is on a branch with a PR to `main` that fills in `.github/PULL_REQUEST_TEMPLATE.md`
  (summary, requirement IDs, type of change, checklist, how it was tested, screenshots beside the
  mocks on a phone and a laptop). Fetch and rebase onto `main` first, because another session may
  have pushed to it.
- Only then end the run, with a short summary of what was built, the decisions made along the way, and
  anything deferred.
