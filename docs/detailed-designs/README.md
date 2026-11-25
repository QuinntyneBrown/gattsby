# Gattsby detailed designs

One detailed design per feature, written against the L2 requirements in
[`docs/specs/L2.md`](../specs/L2.md) with the `writing-software-design-documents` skill. Every L2
requirement (75 `FR-`, 26 `NFR-` and 34 `TOOL-`) appears in exactly one feature's Requirements
table. The 60 features sit in 16 subsystems that follow the L1 groups of
[`docs/specs/L1.md`](../specs/L1.md).

Each feature folder holds a `README.md` with four sections (Overview, Description, Requirements,
Diagrams) and a `diagrams/` folder with PlantUML sources and their rendered PNGs: C4 context,
container and component views, a class diagram, and one sequence diagram per behaviour. The
system-wide C4 views are in [`diagrams/`](diagrams/).

Gaps that the specs and mocks leave open are marked `<TO SUPPLY>` in each design, or cite the open
question (`OQ-nn`) or assumption (`A-nn`) that governs them. The frontend stack is Angular, pending
ADR 0001.

## Rendering the diagrams

```bash
python3 .claude/skills/writing-software-design-documents/scripts/render_puml.py docs/detailed-designs/<subsystem>/<feature>
```

The script needs PlantUML and Graphviz (`dot`). The PNGs in this tree were rendered with PlantUML
1.2020.02.

## Features

### environment

| Feature | L2 requirements |
|---|---|
| [Check capabilities](environment/check-capabilities/README.md) | FR-001, FR-002, FR-003, NFR-021, NFR-026, TOOL-001 |
| [Choose the operating mode](environment/choose-the-operating-mode/README.md) | FR-005, FR-006 |
| [Prepare the model](environment/prepare-the-model/README.md) | FR-004 |

### investigation

| Feature | L2 requirements |
|---|---|
| [Label the location](investigation/label-the-location/README.md) | FR-010 |
| [Start an investigation](investigation/start-an-investigation/README.md) | FR-007, FR-008 |
| [Stop, pause and resume an investigation](investigation/stop-pause-and-resume/README.md) | FR-009 |

### discovery

| Feature | L2 requirements |
|---|---|
| [Handle a device not found](discovery/handle-a-device-not-found/README.md) | FR-014, TOOL-034 |
| [Scan for the device](discovery/scan-for-the-device/README.md) | FR-011, FR-012, FR-067, NFR-016, TOOL-002, TOOL-003, TOOL-032 |
| [Tell candidates apart](discovery/tell-candidates-apart/README.md) | FR-013, TOOL-004, TOOL-005 |

### connection

| Feature | L2 requirements |
|---|---|
| [Connect to the device](connection/connect-to-the-device/README.md) | FR-015, TOOL-006 |
| [Detect a held device](connection/detect-a-held-device/README.md) | FR-017 |
| [Recover a dropped connection](connection/recover-a-dropped-connection/README.md) | FR-016, NFR-007, TOOL-007 |
| [Release the connection](connection/release-the-connection/README.md) | FR-018, TOOL-008 |

### identification

| Feature | L2 requirements |
|---|---|
| [Match known profiles](identification/match-known-profiles/README.md) | FR-021, TOOL-012, TOOL-020 |
| [Read a photo](identification/read-a-photo/README.md) | FR-022, NFR-017, TOOL-027 |
| [Read the GATT layout](identification/read-the-gatt-layout/README.md) | FR-019, FR-020, TOOL-009, TOOL-010, TOOL-011 |
| [Report hidden services](identification/report-hidden-services/README.md) | FR-023 |

### standard-protocols

| Feature | L2 requirements |
|---|---|
| [Confirm with an action](standard-protocols/confirm-with-an-action/README.md) | FR-025, TOOL-033 |
| [Decode standard data](standard-protocols/decode-standard-data/README.md) | FR-024, NFR-003, TOOL-013, TOOL-015 |
| [Determine readable metrics](standard-protocols/determine-readable-metrics/README.md) | FR-027 |
| [Show live metrics](standard-protocols/show-live-metrics/README.md) | FR-026 |

### proprietary-analysis

| Feature | L2 requirements |
|---|---|
| [Detect framing](proprietary-analysis/detect-framing/README.md) | FR-031, TOOL-019 |
| [Find and correlate fields](proprietary-analysis/find-and-correlate-fields/README.md) | FR-029, FR-030, TOOL-016, TOOL-017, TOOL-018 |
| [Record a baseline and activity levels](proprietary-analysis/record-baseline-and-activity/README.md) | FR-028, TOOL-014 |
| [Try a vendor handshake](proprietary-analysis/try-a-vendor-handshake/README.md) | FR-032, FR-033, TOOL-023 |

### device-control

| Feature | L2 requirements |
|---|---|
| [Approve a command](device-control/approve-a-command/README.md) | FR-034, FR-035, NFR-018 |
| [Emergency stop](device-control/emergency-stop/README.md) | FR-039, TOOL-024 |
| [Keep commands conservative](device-control/keep-commands-conservative/README.md) | FR-036, TOOL-031 |
| [Request control](device-control/request-control/README.md) | FR-037, TOOL-021 |
| [Test one command](device-control/test-one-command/README.md) | FR-038, FR-040, NFR-019, TOOL-022 |

### agent

| Feature | L2 requirements |
|---|---|
| [Apply heuristics first](agent/apply-heuristics-first/README.md) | FR-046, NFR-001 |
| [Decide the next action](agent/decide-the-next-action/README.md) | FR-041, FR-042, FR-047, NFR-002, NFR-020 |
| [End the loop](agent/end-the-loop/README.md) | FR-045 |
| [Run the checklist](agent/run-the-checklist/README.md) | FR-049 |
| [Show agent activity](agent/show-agent-activity/README.md) | FR-048 |
| [Validate and run an action](agent/validate-and-run-an-action/README.md) | FR-043, FR-044, NFR-013 |

### person-interaction

| Feature | L2 requirements |
|---|---|
| [Ask a question](person-interaction/ask-a-question/README.md) | FR-050, TOOL-025 |
| [Request a physical action](person-interaction/request-a-physical-action/README.md) | FR-051, TOOL-026 |
| [Skip a step](person-interaction/skip-a-step/README.md) | FR-052 |

### outcome

| Feature | L2 requirements |
|---|---|
| [Build the device profile](outcome/build-the-device-profile/README.md) | FR-055, FR-056 |
| [Issue the verdict](outcome/issue-the-verdict/README.md) | FR-054, FR-057, TOOL-030 |
| [Record a missing tool](outcome/record-a-missing-tool/README.md) | FR-058, FR-059, TOOL-029 |
| [Track the hypothesis](outcome/track-the-hypothesis/README.md) | FR-053, TOOL-028 |

### persistence

| Feature | L2 requirements |
|---|---|
| [Delete all data](persistence/delete-all-data/README.md) | FR-065 |
| [Export a profile or record](persistence/export-a-profile-or-record/README.md) | FR-062, FR-063, NFR-024 |
| [Import profiles and records](persistence/import-profiles-and-records/README.md) | FR-064, NFR-015 |
| [Keep a history](persistence/keep-a-history/README.md) | FR-061 |
| [Save as it runs](persistence/save-as-it-runs/README.md) | FR-060, NFR-008 |

### knowledge-base

| Feature | L2 requirements |
|---|---|
| [Add a vendor signature](knowledge-base/add-a-vendor-signature/README.md) | FR-068 |
| [Load the knowledge base](knowledge-base/load-the-knowledge-base/README.md) | FR-066, FR-069 |

### tool-registry

| Feature | L2 requirements |
|---|---|
| [Log raw traffic](tool-registry/log-raw-traffic/README.md) | FR-073, NFR-005 |
| [Register a tool](tool-registry/register-a-tool/README.md) | FR-070, FR-071, NFR-022 |
| [Return a result envelope](tool-registry/return-a-result-envelope/README.md) | FR-072 |

### platform

| Feature | L2 requirements |
|---|---|
| [Fit one hand and every screen](platform/fit-one-hand-and-every-screen/README.md) | NFR-009, NFR-010, NFR-011 |
| [Keep data on the device](platform/keep-data-on-the-device/README.md) | NFR-012 |
| [Load fast and work offline](platform/load-fast-and-work-offline/README.md) | NFR-004, NFR-006, NFR-014 |
| [Record local diagnostics](platform/record-local-diagnostics/README.md) | NFR-025 |
| [Test without hardware or a model](platform/test-without-hardware-or-a-model/README.md) | NFR-023 |

### later-phases

| Feature | L2 requirements |
|---|---|
| [Run a model on phones](later-phases/run-a-model-on-phones/README.md) | FR-074 |
| [Share profiles publicly](later-phases/share-profiles-publicly/README.md) | FR-075 |

## Open points found while designing

Writing the designs surfaced the following disagreements between the requirements, the mocks and
the platform. Each design records its own choice; each point below should be settled in the specs,
the mocks or an ADR, and the affected designs brought in line.

### Safety and control

- The unexpected-effect mock (`dialogs/unexpected-effect/default.html`) says "I sent Stop" with no
  approval. An automatic stop conflicts with FR-034 and TOOL-024; the
  [test-one-command](device-control/test-one-command/README.md) design asks for approval first.
- The leave-investigation and unexpected-effect dialog mocks have no Emergency stop button,
  although FR-039 requires one on every screen while a device is connected.
- The approval mock lowers a moving belt from 6.0 to 5.9 km/h; FR-036 and A-06 cover only the
  first speed from rest. Limits for a moving machine and for rowers and cross-trainers are open
  (OQ-07).
- [Approve a command](device-control/approve-a-command/README.md) holds one characteristic and one
  byte string per token. A multi-write vendor handshake
  ([try a vendor handshake](proprietary-analysis/try-a-vendor-handshake/README.md)) and the
  emergency-stop token (`ApprovalLedger.issueEmergencyStop`,
  [emergency stop](device-control/emergency-stop/README.md)) extend it; approve-a-command is not
  yet updated to match.
- FR-054 does not name the verdict after an emergency stop, and no verdict fits a connected device
  with nothing decoded, no varying field and no missing-tool request (OQ-06).

### Requirements that disagree with each other or with the platform

- NFR-014's `Permissions-Policy` allowing only `bluetooth` and `camera` would switch off the Prompt
  API (`language-model`); its `default-src 'self'` blocks Angular's component styles without a
  `style-src`; its ban on `unsafe-eval` rules out run-time JSON Schema compilation (affects FR-043,
  NFR-015) and may affect a WebAssembly model runtime (FR-074). The validator library needs an ADR.
- The shared error codes (L2 section 3) have no code for a defect inside Gattsby (a tool that
  throws, or output that fails its schema). The designs use a proposed `INTERNAL_ERROR`.
- FR-045 AC3 (a third repeated refusal is no progress) and FR-006 AC2 (fall back to checklist mode)
  fire together; [end the loop](agent/end-the-loop/README.md) applies the fallback.
- FR-023 AC1 (MVP) needs advertised unknown 128-bit UUIDs, which only `watch_advertisements` (P2)
  can see; TOOL-002's `advertisedServices` cannot be read without it.
- FR-030 lists 8, 16 and 32-bit encodings and TOOL-018 adds 24-bit; TOOL-018 takes one
  `recordingId` while its criteria span three speeds; TOOL-019 has one overall `fit` while FR-031
  asks for a fit per element; TOOL-023's error list omits `INVALID_INPUT`, which its own criterion
  uses; TOOL-027 always returns a `photoId`, which the typed path has none of.
- NFR-001 (verdict within 3 minutes) cannot run in real time inside the 5-minute CI limit; the
  design measures it with a fake clock.
- A record over 20 MB can be exported but not re-imported (NFR-015).

### Mocks that disagree with the requirements

- The readiness mocks show six rows where FR-001 lists five, and need permission-denied and
  storage-blocked fields that TOOL-001 does not return.
- The find-candidates mock lists four chooser candidates that the page cannot read (A-10); the
  not-connectable verdict counts "14 other devices seen", which the page cannot count either.
- FR-052 asks for Skip on every question; the Prepare mock offers only "Don't know". The action
  prompt's step-specific buttons ("Incline is at 2%", "It didn't change") have no fields in
  TOOL-026.
- A mock listens for 10 s after Done; FR-025 and A-12 give 15 s.
- The composer ("Ask the agent or tell it what to try") and its "Speak" button have no requirement.
  Speech needs the microphone, which NFR-016 and NFR-014 do not allow, and may send audio off the
  device (NFR-012).
- The add-note dialog's Note field, the device profile's Notes, Reconnect and Investigate again,
  the missing-tools page's Open and Built status, and the verdict page's "Suggested next steps" and
  "What might work instead" have no requirement.
- FR-063 makes only photos optional; the export dialog's box says "Include notes and photos".
  FR-064 AC1 says an imported profile appears in the history; the mock says "Saved devices". NFR-008
  puts storage use in the history; the mock puts it in Settings.
- NFR-024 asks for a semantic version; the mocks show the knowledge-base version as "2026.11".
- The proprietary mock records the idle baseline with `subscribe_and_record`, not
  `baseline_vs_activity`.
- Verdict and missing-tools copy speaks as the agent in the first person ("I couldn't…").

### Mocks still to draw

Capture and failed-read states of the photo dialog (and the Skip its invalid state mentions); a
knowledge-base load failure; a handshake approval; the `compare_with_console` prompt; stale live
readings; skipping a stage partway through; a verdict that says "step budget reached" or "no
progress"; the evidence log filtered to one reference (FR-056); storage full during an
investigation; the paused dialog after a hidden-page disconnect; how a simulated device is chosen
in development; the phone model's download offer; a phone in landscape.

### Accessibility in the mocks

The investigation dock is `aria-live` and contains the 1 Hz readings; the composer's icon buttons
are 44 px (under 48 px); the prompt detail line is 14 px at 5.6:1; the 576 px breakpoint of NFR-010
is not among the widths the mocks are checked at.
