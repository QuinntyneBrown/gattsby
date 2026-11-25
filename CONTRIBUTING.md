# Contributing to Gattsby

Thank you for your interest in Gattsby. This guide explains how to propose a change and what a pull
request needs before it can be merged.

By taking part you agree to follow the [code of conduct](CODE_OF_CONDUCT.md).

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Before you start](#before-you-start)
- [How a change is made](#how-a-change-is-made)
- [Development setup](#development-setup)
- [Coding conventions](#coding-conventions)
- [Testing](#testing)
- [Commits and pull requests](#commits-and-pull-requests)
- [Licensing of contributions](#licensing-of-contributions)

## Ways to contribute

- **Report a bug.** Open an issue with the steps, what you expected and what happened. Include the
  device's maker and model, your operating system, your Chrome version and whether you were in full
  agent mode or checklist mode. For anything about a device, attach the exported investigation
  record. Read it before you share it: it holds the device's name and identifiers and any location
  label you typed.
- **Suggest a feature.** Open an issue saying who it is for and how it helps identify a device or
  decide how to connect to it.
- **Add a vendor signature.** The knowledge base is data. A vendor's service UUIDs, name patterns,
  manufacturer ID and known handshake, with a source for each, are a real help. Never contribute a
  way to bypass pairing, encryption or authentication.
- **Improve the documentation.** The brief, requirements, designs and mocks are all in `docs/` and
  welcome corrections.
- **Test on your hardware.** Running Gattsby against a treadmill, bike, rower or sensor and
  reporting the verdict, with the exported profile, is a real help.

Security vulnerabilities are never reported in a public issue; see [`SECURITY.md`](SECURITY.md).

## Before you start

1. Read [`AGENTS.md`](AGENTS.md). It is the single source of the repository's rules, and it applies
   to people and coding agents alike.
2. Read [`docs/application-brief.md`](docs/application-brief.md) and the requirements in
   [`docs/specs/`](docs/specs/) for the area you will change.
3. Read the architecture decision records in `docs/adr/` for that area, once they exist.
4. For anything larger than a small fix, open an issue first so the approach can be agreed before
   you write code.

Every change serves what Gattsby is for: identifying an unknown Bluetooth device and working out how
to connect to it. A change that cannot be traced back to that does not belong here.

Use the words the requirements use (`docs/specs/`) in code, docs and UI; do not invent synonyms.

## How a change is made

Gattsby is built requirement first and test first.

1. **Requirement.** Every change to production behaviour has a requirement with acceptance criteria
   in `docs/specs/`.
2. **Detailed design.** The feature has a design in `docs/detailed-designs/`.
3. **Mock.** Every screen and state the change touches has a mock in `docs/mocks/`. The mocks are
   the source of truth for the UI.
4. **Slices.** The work is planned as small, reviewable slices.
5. **Acceptance test first.** For each slice, write the Given-When-Then criteria and the acceptance
   test, with a header naming the requirement IDs it covers, and run it to prove it fails for the
   expected reason before writing production code.
6. **Implement, then refactor** with the tests green, and run the regression checks before the next
   slice.

Documentation-only, mock-only, design-system-only and test-only changes do not need steps 1 to 3
unless they are part of a production behaviour change. Do not write tests for mocks or the design
system, and never add architecture tests (tests that assert the shape of the code rather than its
behaviour).

The skills in `.agents/skills/` (mirrored in `.claude/skills/`) describe each step for coding
agents: `engineering-requirements`, `writing-software-design-documents`, `writing-html-mocks`,
`extracting-design-systems` and `implementing-incrementally`.

## Development setup

There is no frontend yet. When there is, [Getting started](README.md#getting-started) in the README
will give the prerequisites and commands. You will need Chrome; you will not need a real device,
because every feature runs end to end against a simulated one.

## Coding conventions

- The formatter and the linter own formatting and lint; CI fails on either.
- One type per file.
- Only the BLE layer touches `navigator.bluetooth`; only the model adapter touches `LanguageModel`;
  only the investigation store touches IndexedDB.
- The model never decodes bytes. Decoders, the encoding guesser and the framing detector are
  deterministic code with unit tests.
- A new tool is a tool registry entry; a new vendor is a knowledge-base entry. Neither changes the
  agent loop.
- Every `write` and `control` tool asks for the person's approval for each call. No code path may
  skip it.
- Model output, device names and byte-derived strings are rendered as text, never as HTML.
- Keep the device profile and investigation record formats versioned; a change to either bumps its
  version and keeps older exports importable.
- A contract refuses with an error whose `code` a screen branches on.
- Every interaction works with touch and with the keyboard, colour is never the only carrier of a
  state, and motion respects `prefers-reduced-motion`.

## Testing

- **No automated test uses a real device, Bluetooth or model.** Behaviour specs run against a fake
  `navigator.bluetooth` that plays scripted devices and records every write, and a fake
  `LanguageModel` that returns scripted actions.
- Unit tests advance a fake clock instead of sleeping.
- Use the Page Object Model: selectors live in page objects, never in a spec.
- Run frontend tests in Chromium only.
- Do not run the visual, responsive or accessibility sweeps or update baselines unless the
  repository owner asks; do keep them current.
- Hardware smoke tests are run by hand, with a real device.

## Commits and pull requests

- Branch from `main`; never commit to `main` directly.
- Keep each pull request to one concern, and each commit to one slice.
- Write commit subjects in the imperative mood, as a sentence that says what the change does (for
  example, "Decode FTMS treadmill data").
- Fill in the pull request template: what changed, why, the requirement it satisfies and how it was
  tested.
- Keep the requirement, detailed design, mock, tests and code in agreement within the same pull
  request.
- CI must be green before review.

## Licensing of contributions

Gattsby is licensed under the [MIT License](LICENSE). By submitting a contribution you agree that it
is licensed under the same terms, and you confirm that you have the right to submit it.
