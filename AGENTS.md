## Purpose

> Gattsby identifies an unknown Bluetooth fitness or IoT device, and works out how to talk to it,
> in minutes, from the browser. An on-device AI agent drives a library of pre-written Bluetooth
> tools while the person standing next to the machine follows its prompts. The result is a device
> profile, with evidence, that says what the device is, what it reports, what it can be told to do
> and which tools the agent still lacked.

Gattsby is for a developer or technical founder who builds fitness software, standing beside a
treadmill or spin bike in a store or gym, who needs to know before committing to the machine
whether their software can talk to it, and how. A non-technical helper following the agent's prompts
is the secondary user.

Gattsby is a static, client-only single-page app for Chrome. It has no backend and sends no data
off the device. The agent's model is Gemini Nano, through Chrome's Prompt API. Where no model is
available (Chrome on Android today), the same diagnostic playbook runs as a checklist.

Gattsby does not build workouts or a production fitness app. It does not modify firmware, bypass
pairing or encryption, or change a device's settings or pairings. It does not reach Bluetooth
Classic, ANT+, Wi-Fi or USB devices; it detects them and reports them as not connectable. It has no
accounts and no cloud sync. Before adding or changing anything, ask how it helps identify a device
and decide how to connect to it. If it does not, do not build it. If a request works against it,
say so.

The mission, Gattsby's single L0 requirement, is not written yet. When it is written, it goes in
`docs/specs/L0.md` and this section quotes it word for word. Everything then points back to it. Do
not invent a mission in its place.

## Sources of truth

- **Technical scope:** [`docs/application-brief.md`](docs/application-brief.md), and the
  requirements derived from it in [`docs/specs/L1.md`](docs/specs/L1.md) and
  [`docs/specs/L2.md`](docs/specs/L2.md).
- **User-facing behaviour:** the companion *Gattsby: Behavior Description*. It overrides the brief
  on user-facing behaviour. It is not in the repository yet; when it is added, it goes in
  `docs/behavior.md`, and the requirements are brought in line with it.
- **The UI:** the mocks in `docs/mocks/`, once they are drawn, are the source of truth for every
  screen in every state. The requirements, the ADRs, `docs/detailed-designs/` and the code follow
  the mocks. When a mock changes, the requirement, the ADR it touches and the detailed design are
  brought in line with it, in that order, before any code.

## Words

Use the words the specs use in code, docs and UI; no synonyms.

- The **person** is whoever is holding the phone or laptop. The **device** is the machine or sensor
  being identified.
- An **investigation** is one attempt to identify one device, from opening the app to the verdict.
  Its steps, raw traffic, answers and hypotheses are its **investigation record**.
- The **agent** is the orchestrator and the model together. A **tool** is one entry in the tool
  registry; an **action** is one JSON decision the model returns (`call_tool`, `ask_user`,
  `update_hypothesis`, `request_missing_tool`, `finish`).
- Each tool has a **safety class**: `read`, `listen`, `write` or `control`. The person's yes to one
  `write` or `control` call is its **approval**.
- The ordered strategy is the **playbook**. **Full agent mode** runs it with a model; **checklist
  mode** runs it without one.
- An **observation** is a fact a tool established; a **hypothesis** is the current protocol guess,
  with its **confidence** and **evidence**.
- The **verdict** ends an investigation. The **device profile** is its exportable result. A
  **missing-tool request** records a capability the agent lacked.
- The **knowledge base** is the protocol knowledge base: known UUIDs, decoders, vendor signatures,
  name patterns and manufacturer IDs.

## Where things are

- **The frontend is the product.** There is no backend, and nothing in the app calls an API.
  Gattsby is static files served over HTTPS.
- **The frontend stack** is an Angular workspace in `frontend/`, matching the owner's other apps
  and the `angular-developer` and `angular-new-app` skills in this repository
  ([ADR 0001](docs/adr/0001-frontend-stack.md)). Commands are in the README's "Getting started".
- Before building a feature, read its requirement (`docs/specs/`), its detailed design
  (`docs/detailed-designs/`) and its mocks (`docs/mocks/`).
- Read the relevant ADRs in `docs/adr/` before changing the areas they cover.
- Where a rule below names something that does not exist yet (a project, a command, a fixture, a
  helper, a folder), the first change that needs it adds it.

### Folder structure

The expected layout once the code is implemented. Folder names follow `docs/detailed-designs/`; a
change that departs from them updates this tree and the design in the same change. Unit tests sit
beside the code they test as `*.spec.ts`.

```text
gattsby/
├── AGENTS.md                       # This file; CLAUDE.md points here
├── .github/
│   ├── workflows/                  # CI: lint, build, one critical acceptance path per feature
│   └── ISSUE_TEMPLATE/, PULL_REQUEST_TEMPLATE.md
├── .claude/skills/, .agents/skills/  # Agent skills (requirements, designs, mocks, ATDD)
├── docs/
│   ├── application-brief.md        # Technical scope
│   ├── behavior.md                 # Gattsby: Behavior Description (when added)
│   ├── lessons-learned.md          # One entry per slice
│   ├── specs/                      # L0.md (mission, when written), L1.md, L2.md
│   ├── adr/                        # Architecture decision records, from 0001 (frontend stack)
│   ├── detailed-designs/           # {subsystem}/{feature}/README.md + diagrams/
│   ├── mocks/                      # pages/, dialogs/, notifications/; source of truth for the UI
│   ├── design-system/              # Tokens and components extracted from the mocks
│   └── assets/                     # Logos
└── frontend/                       # Angular workspace (ADR 0001)
    ├── public/                     # _headers, favicon, manifest.webmanifest (fonts: design system)
    ├── scripts/                    # Build checks (bundle, headers, ...) and serve-dist.ts
    ├── e2e/                        # Playwright, Chromium only
    │   ├── fixtures/               # gattsby-test.ts, the fakes' handles, guards, misbehaviour
    │   ├── pages/                  # One page object per screen or dialog (*.page.ts)
    │   └── *.spec.ts               # Behaviour specs, each headed with its requirement IDs
    └── src/
        ├── knowledge-base/         # Data, not code; versioned JSON
        │   ├── standard/           # Standard UUIDs and profiles (FTMS, ...), confirmation rules
        │   ├── vendors/            # Vendor signatures, name patterns, manufacturer IDs
        │   ├── commands/           # Command definitions
        │   ├── limits/             # Safe speed, incline and resistance limits
        │   └── generated/          # Compiled knowledge-base.json (build output)
        ├── schemas/                # JSON schemas for exported records and profiles
        ├── simulation/             # Fake Bluetooth API and model; devices/*.device.ts
        └── app/
            ├── app.routes.ts, app-shell.ts
            ├── agent/              # Orchestrator: loop, playbook, rules/, approvals, stops
            ├── model/              # Model adapter: sole user of LanguageModel
            ├── tools/              # Tool registry and tools, one folder per tool group:
            │   ├── discovery/      #   scan, watch advertisements, permitted devices
            │   ├── connection/     #   connect, reconnect, disconnect
            │   ├── inspection/     #   enumerate GATT, read device info and characteristics
            │   ├── listening/      #   subscribe and record
            │   ├── analysis/       #   decode, detect framing, guess encodings, vendor lookup
            │   ├── control/        #   request control, send command, emergency stop
            │   ├── person/         #   ask, request an action, capture a photo
            │   ├── environment/    #   check capabilities
            │   └── meta/           #   update hypothesis, request missing tool, finish
            ├── ble/                # BLE layer: sole user of navigator.bluetooth; traffic log
            ├── knowledge-base/     # Loader, decoders/, matchers, safe limits
            ├── store/              # Store: sole user of IndexedDB; import, export, model/
            ├── analysis/           # Byte-level helpers: framing, encodings, checksums
            ├── outcome/            # Hypothesis, confidence, verdict, profile, missing tools
            ├── environment/        # Capability detection and operating mode
            ├── live/               # Live metrics and formatting
            ├── photo/              # Camera adapter and photo sanitizer (imported dynamically)
            ├── security/           # Trusted Types policy, display-text rendering
            ├── shared/             # Cross-cutting helpers such as the clock
            ├── pages/              # Lazy-loaded pages; one per mock in docs/mocks/pages/
            ├── dialogs/            # One folder per mock in docs/mocks/dialogs/
            ├── notifications/      # Connection banner, mode banner, toast
            └── ui/                 # Presentation components; no app services
```

## Architecture

Six parts. **The model chooses; code executes and decodes.**

| Part | Owns |
|---|---|
| Agent orchestrator | The observe → decide → act loop, step budgets, timeouts, stop conditions, approvals, and the route to checklist mode |
| Model adapter | The only code that touches `LanguageModel` (or any later in-browser model): availability, download progress, structured output, aborts |
| Tool registry | Every tool's name, description, input and output schemas, safety class and preconditions; generates the tool list the model sees |
| BLE layer | The only code that touches `navigator.bluetooth`: scan, connect, reconnect, GATT, reads, notifications, writes, disconnect events, the raw traffic log |
| Protocol knowledge base | Data, not code: UUIDs, standard decoders, vendor signatures, name patterns, manufacturer IDs; versioned |
| Investigation store | The only code that touches IndexedDB: investigations, raw logs, observations, hypotheses, profiles, missing-tool requests, import and export |

- **The model never decodes bytes or scores hypotheses.** Deterministic code does, and its
  heuristics run before the model is asked, so the model handles only the ambiguous cases.
- **Every model action is untrusted.** The orchestrator validates it against its JSON schema and the
  safety rules before running it. An invalid action is refused and counted against the step budget.
- **Adding a tool or a knowledge-base entry needs no change to the agent loop.** A tool is a
  registry entry; a vendor is a data entry.
- **Capability detection everywhere.** Each browser API (Prompt API, Web Bluetooth,
  `watchAdvertisements`, `requestLEScan`, camera) sits behind an adapter that reports whether it is
  available. A missing capability degrades the feature; it never throws at the person.
- **Bound what grows.** Prompt history, recordings and the raw traffic log in memory use fixed-size
  or windowed buffers, or are persisted and dropped from memory.

## Safety (non-negotiable)

These rules outrank every other rule in this file, every requirement and every request.

- **Read-only by default.** Every `write` or `control` tool call needs the person's explicit
  approval at that moment, every time. An approval covers one call. No setting, mode or model
  output can skip it.
- **Before any motion command,** the person is reminded to stand clear and to know where the
  machine's own physical stop is.
- **Lowest risk first.** Start with the lowest-risk command and the smallest change. Never set a high
  speed or incline. The limits are data in the knowledge base, and code enforces them.
- **Emergency stop is always one tap away** on every screen while a device is connected. It sends
  stop or reset, refuses every later write and stops the agent loop.
- **Respect the store.** Gattsby never changes a device's settings, pairings or firmware, and never
  attempts to bypass pairing, encryption or authentication. An encrypted protocol is recorded and
  raised as a missing-tool request.
- **Model output is text.** Model output, device names and every byte-derived string are rendered
  as text, never as HTML.

## Privacy

- All data stays in the browser. No backend, no analytics, no third-party requests at run time.
- Photos are stored locally and sent only to the on-device model.
- Export is the only way data leaves the device, and the person starts it.

## Prefer best practice

Choose the platform's established best practice (the frontend framework's, Playwright's, WCAG's)
over the expedient way. A departure needs an ADR giving its reason. If a rule here or in an ADR
conflicts with best practice, say so and propose the correction; do not work around it silently.

## Frontend

- Prettier and the framework's lint own formatting and lint; CI fails on either.
- One type per file. Presentation components take inputs and emit outputs and inject no app
  service; pages that orchestrate stay in the app.
- Logic with many cases (the orchestrator, decoders, the encoding guesser, the framing detector, a
  store) lives in a service or a pure helper with unit tests, never in a component.
- Each service has a contract; components depend on the contract.
- A contract refuses with an error whose `code` a screen branches on; the person sees a plain
  message that says what to do next.
- **Usable one-handed beside a machine.** Every prompt is readable at arm's length, touch targets
  are at least 48 × 48 px, and the primary action sits within reach of the thumb. Every interaction
  works by touch on a phone and by keyboard on a desktop. Colour is never the only carrier of a
  state, and motion respects `prefers-reduced-motion`.
- Fonts and icons are bundled and self-hosted, never loaded from a CDN.
- **Load only what is needed now.** Routes are lazy-loaded; the model adapter, the analysis tools
  and the camera are imported dynamically. Release whatever is acquired: listeners, notification
  subscriptions, timers, `AbortController`s, model sessions, object URLs and media streams.

## E2E (Playwright)

- **No real device, Bluetooth or model, and no network beyond localhost.** Fixtures install a fake
  `navigator.bluetooth` that plays scripted devices (an FTMS treadmill, an FTMS bike, a heart-rate
  strap, a device with only unknown services) and records every write, and a fake `LanguageModel`
  that returns scripted actions. An unexpected Bluetooth call, an unapproved write, a request off
  localhost or a page error fails the spec.
- Page Object Model: one page object per screen or dialog owns the selectors. Never put a selector
  in a test.
- Only behaviour specs run by default. Visual, responsive and accessibility sweeps are written and
  kept current but run only when a person asks.
- Chromium only; never configure or run another browser.
- In unit tests, time-driven rules (recording windows, step timeouts, reconnects) advance a fake
  clock; never sleep.
- Hardware smoke tests (a real treadmill, bike or strap) are run by a person, never by an agent or
  CI.

## CI (GitHub Actions)

- The pipeline is always green and finishes in under 5 minutes. A flaky or slow check is fixed or
  removed, never retried.
- It runs lint, the build and one critical acceptance path per feature. Unit tests run locally.
- A setting a deployed system needs is documented in the same change.

## Incremental implementation and ATDD (mandatory for product code)

Every change to user-impacting product code needs a requirement, a detailed design and a mock
before implementation, and is built incrementally. Mocks, designs, the design system, docs and
test-only changes are exempt and get no tests.

- Requirements: the `engineering-requirements` skill (`docs/specs/L1.md`, `docs/specs/L2.md`).
- Detailed designs: the `writing-software-design-documents` skill (`docs/detailed-designs/`).
- Mocks: the `writing-html-mocks` skill (`docs/mocks/`); the design system is extracted from them
  with the `extracting-design-systems` skill.
- Implementation: invoke and follow the `implementing-incrementally` skill, with ATDD. Plan small
  slices and finish one at a time. For each, write Given-When-Then criteria, write the acceptance
  test (Playwright with page objects) with a header naming the requirement IDs it covers, run it to
  prove it fails for the expected reason, then implement only that slice, refactor green and run
  the regression checks before the next. No bulk implementation, no tests added afterwards, no
  weakening tests to pass.

Never write architecture tests: no structure, layout, naming, banned-API or spec-traceability
tests. A test suite proves behaviour.

## Lessons learned

Before a slice, read `docs/lessons-learned.md` (once it exists) and apply the lessons that fit.
When the slice finishes, before it merges, add its entry there: what slowed it, new lessons, and
how each earlier lesson it applied worked.
