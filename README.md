<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/gattsby-logo-dark.svg">
    <img src="docs/assets/gattsby-logo.svg" alt="Gattsby" width="360">
  </picture>
</p>

# Gattsby

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Status: requirements](https://img.shields.io/badge/status-requirements-orange.svg)
![Platform: Chrome](https://img.shields.io/badge/platform-Chrome-4285F4.svg)

Gattsby identifies an unknown Bluetooth fitness or IoT device, and works out how to talk to it, in
minutes, from the browser. An on-device AI agent (Gemini Nano, through Chrome's Prompt API) drives a
library of pre-written Bluetooth tools, while you follow its prompts beside the machine. You get a
device profile, with evidence: what the device is, which metrics it reports, which features it can
be told to control, and which tools the agent still lacked.

Gattsby is a static, client-only web app. It has no backend, and no data leaves the browser.

> [!IMPORTANT]
> Gattsby is in the requirements phase. There is no runnable app yet. The requirements are in
> [`docs/specs/`](docs/specs/), derived from the [application brief](docs/application-brief.md).

## Contents

- [Overview](#overview)
- [Features](#features)
- [How it works](#how-it-works)
- [Supported platforms](#supported-platforms)
- [Supported protocols](#supported-protocols)
- [Safety](#safety)
- [Privacy](#privacy)
- [Project status](#project-status)
- [Getting started](#getting-started)
- [Repository structure](#repository-structure)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Code of conduct](#code-of-conduct)
- [Security](#security)
- [Support](#support)
- [License](#license)
- [Trademarks](#trademarks)

## Overview

If you build fitness software that controls hardware over Bluetooth, you need to know whether your
software can talk to a treadmill or spin bike before you commit to it. Gattsby answers that
question while you stand next to the machine in a store or gym:

1. **Prepare.** Gattsby checks what your browser supports, asks what kind of machine it is, and
   asks you to power it on and disconnect any other app or watch.
2. **Find.** It scans for the device and, if several are nearby, tells them apart by asking you to
   switch the machine off and on.
3. **Identify.** It connects, lists the device's Bluetooth services, reads its maker, model and
   firmware, and matches them against a knowledge base of standard and vendor protocols.
4. **Confirm.** It listens while you walk faster or pedal harder, and checks that the decoded
   values move as they should. For a proprietary protocol, it finds the bytes that change and
   works out how they are encoded.
5. **Control (optional).** With your approval for each command, it sends one low-risk command and
   asks you to confirm the effect.
6. **Conclude.** It gives a verdict and a device profile you can export as JSON.

## Features

- **Identifies the device and its protocol:** maker, model, firmware, and the Bluetooth protocol it
  speaks, with a confidence and the evidence for it.
- **Finds the readable metrics:** speed, cadence, power, distance, incline, resistance, heart rate,
  calories and elapsed time, each with its decoding rule.
- **Finds the controllable features:** start, stop, target speed, incline, resistance and power
  target, each with its command bytes.
- **Exportable device profiles** in a versioned JSON format that other apps can consume.
- **Missing-tool requests:** where the agent lacked a capability, it records what and why, to guide
  development.
- **Runs on the device:** the model, the data and the photos stay in the browser.
- **Works without a model:** where Gemini Nano is not available, the same playbook runs as a
  checklist.

## How it works

```
                      ┌────────────────────────┐
  person ◀──prompts──▶│   Agent orchestrator   │◀──JSON action──▶ Model adapter ──▶ Gemini Nano
                      │ observe → decide → act │                  (Prompt API)
                      └───────────┬────────────┘
                                  │ validated tool call
                                  ▼
                      ┌────────────────────────┐      ┌──────────────────────────┐
                      │     Tool registry      │─────▶│ Protocol knowledge base  │
                      └───────────┬────────────┘      │ UUIDs, decoders, vendors │
                                  │                   └──────────────────────────┘
                                  ▼
  device ◀───BLE────▶ BLE layer (Web Bluetooth) ──raw traffic──▶ Investigation store (IndexedDB)
```

| Component | Responsibility |
|---|---|
| Agent orchestrator | Runs the observe → decide → act loop, enforces step limits, timeouts and stop conditions, and falls back to checklist mode when no model is available |
| Model adapter | One interface over Gemini Nano and any later in-browser model: availability, download progress, structured output and aborts |
| Tool registry | The typed catalogue of tools, with their schemas, safety class and preconditions |
| BLE layer | Wraps Web Bluetooth and logs all raw traffic with timestamps |
| Protocol knowledge base | Data, not code: known UUIDs, standard decoders, vendor signatures |
| Investigation store | Persists investigations, raw logs, hypotheses and device profiles; import and export |

The model chooses which tool to run next; deterministic code runs the tool, decodes the bytes and
scores the hypotheses. Every action the model returns is validated against a JSON schema and the
safety rules before it runs. [`AGENTS.md`](AGENTS.md) has the full architecture rules.

## Supported platforms

| Platform | Mode | Notes |
|---|---|---|
| Chrome 148 or later on Windows, macOS, Linux or Chromebook Plus | Full agent mode | Gemini Nano downloads on first use and needs significant free disk space |
| Chrome on Android | Checklist mode | Web Bluetooth works; the Prompt API does not |
| Safari, Firefox, or any browser on iOS | Not supported | No Web Bluetooth |

Gattsby must be served over HTTPS (or `http://localhost`). Reading advertisements without
connecting (`watchAdvertisements`, `requestLEScan`) is experimental, behind a flag in Chrome, and
used only where it is available.

## Supported protocols

The knowledge base covers these Bluetooth SIG services at MVP:

| Protocol | Service | Typical devices |
|---|---|---|
| Fitness Machine Service (FTMS) | `0x1826` | Treadmills, bikes, rowers, cross-trainers |
| Cycling Power | `0x1818` | Smart trainers, power meters, some bikes |
| Cycling Speed and Cadence | `0x1816` | Cadence and speed sensors |
| Heart Rate | `0x180D` | Straps, watches, some consoles |
| Running Speed and Cadence | `0x1814` | Foot pods, some treadmills |
| Device Information | `0x180A` | Almost all devices |
| Battery | `0x180F` | Sensors, wearables |

Vendor signatures for proprietary protocols are added to the knowledge base as they are researched.
Bluetooth Classic, ANT+, Wi-Fi and USB devices cannot be reached from a browser; Gattsby reports
them as not connectable.

## Safety

Gattsby can send commands to exercise equipment that someone may be standing on. These rules are
non-negotiable:

- Gattsby is read-only by default. **Every write or control command needs your explicit approval at
  that moment, every time.**
- Before any command that makes the machine move, Gattsby reminds you to stand clear and to know
  where the machine's own physical stop is.
- It starts with the lowest-risk command and the smallest change, and never sets a high speed or
  incline.
- **Emergency stop** is always available while a device is connected. It stops the machine, refuses
  every later command and stops the agent.
- Gattsby never changes a device's settings, pairings or firmware, and never attempts to bypass
  pairing, encryption or authentication.

## Privacy

- Everything stays in your browser, in IndexedDB. There is no backend and no analytics.
- Photos of a model plate or console are stored locally and are read only by the on-device model.
- Data leaves the device only when you export it.

## Project status

Gattsby is specified and its implementation has started, one journey at a time
([`docs/journeys.md`](docs/journeys.md)).

| Phase | State |
|---|---|
| Application brief | Done ([`docs/application-brief.md`](docs/application-brief.md)) |
| Requirements (L1, L2) | Draft ([`docs/specs/`](docs/specs/)) |
| Behaviour description | Not yet in the repository |
| Mocks and design system | Done ([`docs/mocks/`](docs/mocks/), [`docs/design-system/`](docs/design-system/)) |
| Detailed designs | Done ([`docs/detailed-designs/`](docs/detailed-designs/)) |
| MVP implementation | In progress: journey 1, *Scaffold the app*, is done |

The MVP must identify an FTMS treadmill or bike end to end, in full agent mode and in checklist
mode. The open questions that block later phases are listed in
[`docs/specs/L2.md`](docs/specs/L2.md#7-open-questions).

## Getting started

Prerequisites: [Node.js](https://nodejs.org/) 22.18 or later (the build scripts are TypeScript
run by Node directly), npm, and Chrome. No Bluetooth device or on-device model is needed: the
behaviour specs run against scripted fakes.

```shell
git clone https://github.com/QuinntyneBrown/gattsby.git
cd gattsby/frontend
npm ci
npx playwright install chromium   # once, for the behaviour specs
```

| Command (in `frontend/`) | What it does |
|---|---|
| `npm start` | Development server at `http://localhost:4200` (no security headers) |
| `npm run build` | Production build in `dist/frontend/browser/` |
| `npm run serve:dist` | Serves the production build at `http://localhost:4300` with the headers in `public/_headers` |
| `npm test` | Unit tests (Vitest), once |
| `npm run e2e` | Production build, then every behaviour spec (Playwright, Chromium only) |
| `npm run e2e:critical` | The critical behaviour specs CI runs, against an existing build |
| `npm run lint` / `npm run format` | ESLint / Prettier (`format:check` checks without writing) |
| `npm run check:bundle` | Fails when the initial bundle is over 250 KB gzip (NFR-004) |
| `npm run check:headers -- <url>` | Checks a running Gattsby's security headers (NFR-013, NFR-014); defaults to `http://localhost:4300/` |

The app is served as static files over HTTPS by a host that reads `public/_headers` (Cloudflare
Pages or Netlify), or another host with the same headers translated (ADR 0003). After each
deployment, run `npm run check:headers -- https://<deployed host>/`.

To take part in specifying Gattsby, read, in order:

1. [`docs/application-brief.md`](docs/application-brief.md): what Gattsby is.
2. [`docs/specs/L1.md`](docs/specs/L1.md) and [`docs/specs/L2.md`](docs/specs/L2.md): what it must
   do, with acceptance criteria.
3. [`AGENTS.md`](AGENTS.md): the architecture rules and the required workflow.

## Repository structure

```
gattsby/
├── .agents/skills/          Agent skills (requirements, designs, mocks, incremental delivery, ...)
├── .claude/skills/          The same skills, for Claude Code
├── .github/                 CI workflow, issue and pull request templates
├── docs/
│   ├── adr/                   Architecture decision records
│   ├── application-brief.md   The technical scope Gattsby is built from
│   ├── assets/                The Gattsby logo and mark (SVG)
│   ├── design-system/         Tokens and components extracted from the mocks
│   ├── detailed-designs/      One design per feature, with C4, class and sequence diagrams
│   ├── journeys.md            The user journeys, in order, with effort and progress
│   ├── lessons-learned.md     One entry per implemented journey
│   ├── mocks/                 HTML mocks of every screen, dialog and notification in every state
│   ├── prompts/               One implementation prompt per journey
│   └── specs/                 Requirements: L1 (high level), L2 (detailed, with acceptance criteria)
├── frontend/                Angular workspace: the app, its behaviour specs and build checks
├── AGENTS.md                Purpose, architecture, safety rules and workflow, for people and agents
├── CLAUDE.md                Points Claude Code at AGENTS.md
├── CONTRIBUTING.md          How to propose a change
├── CODE_OF_CONDUCT.md       Contributor Covenant
├── SECURITY.md              How to report a vulnerability privately
├── SUPPORT.md               How to get help
└── LICENSE                  MIT
```

## Documentation

| Document | Description |
|---|---|
| [Application brief](docs/application-brief.md) | Gattsby's technical scope, architecture, tool catalogue and playbook |
| [L1 requirements](docs/specs/L1.md) | High-level requirements |
| [L2 requirements](docs/specs/L2.md) | Functional, non-functional and tool requirements, with acceptance criteria, phases, assumptions and open questions |
| [UI mocks](docs/mocks/README.md) | Every screen in every state, light and dark; open [`docs/mocks/index.html`](docs/mocks/index.html) from disk |
| [Design system](docs/design-system/README.md) | Tokens and components extracted from the mocks |
| [Detailed designs](docs/detailed-designs/README.md) | One design per feature |
| [Architecture decisions](docs/adr/) | ADR 0001 (frontend stack), 0002 (initial-bundle check), 0003 (headers file and local server) |
| [Journeys](docs/journeys.md) | The order Gattsby is built in, with progress |
| [AGENTS.md](AGENTS.md) | Purpose, architecture rules, safety rules and the required workflow |

## Contributing

Contributions are welcome. Before you open a pull request, read
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow and [`AGENTS.md`](AGENTS.md) for the
architecture and safety rules. In summary:

- If it does not help identify a device and decide how to connect to it, it does not belong in
  Gattsby.
- Every change to product code needs a requirement, a detailed design and a mock before any code is
  written.
- Work in small slices, and write the failing acceptance test first.
- The safety rules are not negotiable.

## Code of conduct

This project has adopted the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you are
expected to uphold this code.

## Security

Do not report security vulnerabilities through public GitHub issues. See [`SECURITY.md`](SECURITY.md)
for how to report one privately.

## Support

See [`SUPPORT.md`](SUPPORT.md) for how to ask a question, report a bug or request a feature.

## License

Copyright (c) 2026 Quinntyne Brown. Licensed under the [MIT License](LICENSE).

## Trademarks

Gattsby is an independent project. It is not affiliated with or endorsed by Google, the Bluetooth
Special Interest Group, or any fitness equipment maker named in this repository. Chrome and Gemini
are trademarks of Google LLC. Bluetooth is a registered trademark of Bluetooth SIG, Inc. Other
product and company names are the trademarks of their respective owners.
