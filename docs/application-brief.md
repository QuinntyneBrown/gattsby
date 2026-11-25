# Gattsby: application brief

*25 November 2026. The source for [`docs/specs/`](specs/). Kept as written; change the requirements, not
this brief.*

This brief describes Gattsby in enough detail to derive a full set of requirements from it. Gattsby is
a Chrome-only web app. In it, an on-device AI agent (Gemini Nano, through Chrome's Prompt API) uses a
library of pre-written Bluetooth tools to identify an unknown fitness or IoT device and work out how to
connect to it.

## Instructions to the requirements agent

1. Produce functional requirements, non-functional requirements and a tool specification for every
   tool in the catalogue, each with a unique ID (`FR-`, `NFR-`, `TOOL-`).
2. Write acceptance criteria in Given/When/Then form for every functional requirement.
3. Flag every requirement that depends on a browser capability that is experimental, behind a flag
   or limited to some platforms.
4. Separate the MVP from later phases. The MVP must be able to identify an FTMS treadmill or bike end
   to end.
5. List assumptions and open questions instead of inventing answers. The known ones are under
   [Open questions](#open-questions).
6. The companion behavior document (*Gattsby: Behavior Description*) is authoritative for
   user-facing behavior; this brief is authoritative for technical scope.

## Product overview

The owner builds fitness software that controls hardware over Bluetooth (spin bikes, treadmills).
Before committing to a device, he wants to walk into a store or gym, connect to the machine, and
learn within minutes whether his software can talk to it, and how.

- **Primary user:** a developer or technical founder standing next to the machine.
- **Secondary user:** a non-technical helper following the agent's prompts.

### Goals

- Identify the device (maker, model, firmware) and its Bluetooth protocol.
- Determine which metrics can be read (speed, cadence, power, distance, incline, resistance, heart
  rate, calories, elapsed time).
- Determine which features can be controlled (start, stop, target speed, incline, resistance, power
  target).
- Produce a reusable, exportable device profile with evidence.
- Surface the tools the agent lacked, to guide future development.
- Run fully on the device: no backend, and no data leaves the browser.

### Non-goals (MVP)

- Building the owner's production fitness app or workouts.
- Firmware modification, jailbreaking, or bypassing pairing or encryption.
- Bluetooth Classic, ANT+, Wi-Fi or USB devices (detect and report only).
- Support for Safari, Firefox, or Chrome on iOS.
- User accounts or cloud sync.

## Platform and technical constraints

The single biggest constraint: Chrome's on-device Gemini Nano runs only on desktop today, while the
in-store use case is a phone. The requirements must cover both modes.

| Area | Constraint | Implication |
|---|---|---|
| Prompt API (Gemini Nano) | Shipped for web pages in Chrome 148 on Windows, macOS, Linux and Chromebook Plus. Not supported in Chrome for Android or iOS. The model downloads separately on first use and needs significant free disk space. | Full agent mode means a laptop. Phone mode needs a fallback: a scripted playbook, or a small WebGPU model (for example Transformers.js or WebLLM). The app must check `LanguageModel.availability()` and show download progress. |
| Prompt API features | Session context, streaming, structured output through a JSON schema (`responseConstraint`), multimodal image input, `AbortController`. Native tool calling is not guaranteed. | Tool calling is implemented in app code: the model returns a JSON action that matches a schema; the app runs the tool and feeds back a short summary. Image input lets the model read a photo of the model plate or console. |
| Model capacity | Small model, limited context window, weak multi-step reasoning. | Keep prompts short, summarise tool output, cap history, and let deterministic code (not the model) decode bytes and score hypotheses. |
| Web Bluetooth | Works in Chrome on desktop and Android; not on iOS. HTTPS only. `requestDevice()` needs a user gesture. | Every scan starts from a user action. Host on HTTPS. |
| Web Bluetooth service access | Only services listed in the request's `filters` or `optionalServices` can be accessed; Chrome blocks some UUIDs. | The app ships a large known-UUID list (standard and proprietary vendor services) and passes it at scan time. Unknown services are invisible, which limits discovery. |
| Advertisement scanning | Raw scanning (`requestLEScan`) and `watchAdvertisements()` are experimental and behind a flag. | Treat them as optional tools for Chrome Canary; detect and degrade. |
| Connection exclusivity | Most machines accept one BLE central at a time. | The agent asks the person to disconnect the console's own app, watches and phones first. |
| Bluetooth Classic, ANT+ | Not reachable from a browser. | Detect by elimination and report as *Not connectable*. |

## Architecture

A static, client-only single-page app with six parts. The model chooses; code executes and decodes.

| Component | Responsibility |
|---|---|
| Agent orchestrator | Runs the observe → decide → act loop, enforces step limits, timeouts and stop conditions, and routes to fallback mode when no model is available. |
| Model adapter | One interface over Gemini Nano (Prompt API) and any future in-browser model; handles availability, download progress, structured output and aborts. |
| Tool registry | Typed catalogue of tools: name, description, JSON input schema, output schema, safety class (read, listen, write, control) and preconditions. Generates the tool list given to the model. |
| BLE layer | Wraps Web Bluetooth: scan, connect, reconnect, GATT enumeration, reads, notifications, writes, disconnect events. All raw traffic is logged with timestamps. |
| Protocol knowledge base | Data, not code: known service and characteristic UUIDs, decoders for standard profiles, vendor signatures, name patterns and manufacturer IDs. Versioned and extendable. |
| Investigation store | IndexedDB persistence of investigations, raw logs, observations, hypotheses, device profiles and missing-tool requests; import and export. |

**One iteration of the agent loop:**

1. The orchestrator builds a compact state: device facts so far, the current hypothesis and its
   confidence, the last 3 to 5 tool results as one-line summaries, and the tools allowed at this
   stage.
2. The model returns one JSON action: `call_tool`, `ask_user`, `update_hypothesis`,
   `request_missing_tool` or `finish`.
3. The orchestrator validates it against the schema and the safety rules, runs it, and appends the
   summarised result.
4. The loop stops when `finish` is returned, confidence passes a threshold, a step budget is reached,
   or N steps add no new observations.

Deterministic heuristics (for example, "FTMS service present → try the FTMS decoders first") run
before the model is consulted, so the model handles only the ambiguous cases.

## Tool catalogue

The starting set of tools the agent can call.

| Group | Tool | What it does | Safety |
|---|---|---|---|
| Environment | `check_capabilities` | Reports Bluetooth, Prompt API, model status, flags and platform | read |
| Discovery | `scan_devices` | Opens the chooser with known-UUID filters and optional services | read |
| Discovery | `scan_all_devices` | Opens the chooser accepting all devices, with the full optional-service list | read |
| Discovery | `watch_advertisements` | Reads RSSI, manufacturer data and service data (experimental) | read |
| Discovery | `power_cycle_match` | Guides an off/on cycle and identifies which device disappears and returns | read |
| Connection | `connect`, `reconnect`, `disconnect` | Manage the GATT connection; report drops | read |
| Inspection | `enumerate_gatt` | Lists services, characteristics and their properties | read |
| Inspection | `read_device_info` | Reads the Device Information Service (maker, model, serial, firmware) | read |
| Inspection | `read_characteristic` | Reads one value; returns hex and candidate decodings | read |
| Inspection | `match_known_profiles` | Scores the GATT layout and name against the knowledge base | read |
| Listening | `subscribe_and_record` | Records notifications for N seconds with timestamps | listen |
| Listening | `baseline_vs_activity` | Records idle, then during an action, and diffs the two | listen |
| Analysis | `decode_standard` | Decodes FTMS, CSC, CPS, HRS, RSC and Battery payloads | read |
| Analysis | `find_varying_bytes` | Finds which bytes change between recordings | read |
| Analysis | `correlate_with_action` | Ranks byte fields by correlation with a user action (speed up, slow down) | read |
| Analysis | `guess_field_encoding` | Tests uint8/16/32, signed, endianness and scale factors against an expected range | read |
| Analysis | `detect_framing` | Finds headers, lengths, counters and checksums in proprietary packets | read |
| Analysis | `vendor_signature_lookup` | Matches UUIDs, names and manufacturer IDs to known brands | read |
| Control | `request_control` | Sends FTMS Request Control and reports the result code | control |
| Control | `send_command` | Sends a known command (start, stop, set speed, incline or resistance) | control |
| Control | `replay_known_handshake` | Sends a vendor's known init sequence to unlock data | write |
| Control | `emergency_stop` | Sends stop or reset and halts all further writes | control |
| Person | `ask_user` | Asks a question with suggested answers | n/a |
| Person | `request_action` | Asks for a physical action and waits for "ready" and "done" | n/a |
| Person | `capture_photo` | Takes a photo of the model plate or console for the model to read | n/a |
| Meta | `update_hypothesis` | Records the protocol guess, confidence and evidence | n/a |
| Meta | `request_missing_tool` | Records a capability the agent lacks, with reason and evidence | n/a |
| Meta | `finish` | Issues the verdict and builds the device profile | n/a |

Write and control tools always need explicit approval from the person in the moment, every time.

## Diagnostic playbook

The playbook is the ordered strategy the agent follows. It must also run without the model, as the
phone-mode checklist.

1. **Prepare.** Check capabilities; ask the machine type and brand; ask the person to power on and
   disconnect other apps or watches.
2. **Find.** Filtered scan first; if nothing, scan all; if there are several candidates, power-cycle
   match.
3. **Identify.** Connect, enumerate GATT, read Device Information, match against known profiles and
   vendor signatures; optionally read a photo of the model plate.
4. **Standard path.** If a standard service is present, subscribe, ask for a known action, and
   confirm the decoded values move as expected (speed rises when walking faster).
5. **Proprietary path.** Record an idle baseline, then activity at two or three levels; find varying
   bytes; correlate with actions; guess encodings; detect framing; try known vendor handshakes if the
   data is silent.
6. **Control** (optional, with approval). Request control, send one low-risk command (start, or a
   small resistance change), ask the person to confirm the effect, then stop.
7. **Conclude.** Issue the verdict, the profile and any missing-tool requests.

### Protocols the knowledge base covers at MVP

| Protocol | Bluetooth SIG service | Typical devices |
|---|---|---|
| Fitness Machine Service (FTMS) | `0x1826` | Treadmills, bikes, rowers, cross-trainers |
| Cycling Power | `0x1818` | Smart trainers, power meters, some bikes |
| Cycling Speed and Cadence | `0x1816` | Cadence and speed sensors |
| Heart Rate | `0x180D` | Straps, watches, some consoles |
| Running Speed and Cadence | `0x1814` | Foot pods, some treadmills |
| Device Information | `0x180A` | Almost all devices |
| Battery | `0x180F` | Sensors, wearables |

Vendor signatures to research and add (UUIDs, name patterns, handshakes): Echelon (the owner's own
bike; highest priority), Peloton, Keiser (broadcasts data in advertisements without connecting),
iFit / NordicTrack / ProForm, Schwinn / Bowflex / Nautilus, Concept2 PM5, Wahoo, Tacx, Domyos,
Yesoul, Sole and Horizon. Each needs a known-UUID entry so that the browser can see its services at
all.

## Data, privacy and safety

**Device profile** (the core output): device name, maker, model, firmware, advertised and discovered
UUIDs, protocol and confidence, readable metrics with decoding rules (offset, type, scale, unit),
controllable features with command bytes, required handshake, connection quirks, verdict, evidence
references, date, and an optional location label typed by the person.

**Investigation record:** every step with the model's action, tool inputs and outputs, raw BLE
traffic with timestamps, the person's answers, hypotheses over time, and missing-tool requests.

- All data stays in the browser (IndexedDB). No backend, and no analytics by default.
- Export and import as JSON; the profile format is versioned so that other apps (such as the owner's
  fitness apps) can consume it.
- Photos are stored locally and sent only to the on-device model.
- Model output is untrusted: render it as text, never as HTML.

**Safety rules (non-negotiable):**

- Read-only by default; every write or control command needs explicit approval at that moment.
- Before any motion command, remind the person to stand clear and to know the machine's physical
  stop.
- Start with the lowest-risk command and the smallest change; never set a high speed or incline.
- Emergency stop is always available, and it also stops the agent loop.
- Respect the store: the app does not change device settings, pairings or firmware.

## Quality, risks and acceptance

### Quality attributes

- Time to verdict for an FTMS machine: under 3 minutes from opening the app.
- Agent step latency: under 3 seconds per decision on a typical laptop once the model is loaded.
- Works offline after the first load (installable PWA, model cached).
- Survives connection drops without corrupting an investigation.
- Usable one-handed while standing next to a machine; all prompts readable at arm's length.
- Adding a tool or a knowledge-base entry needs no change to the agent loop.

### Risks

| Risk | Mitigation |
|---|---|
| Gemini Nano unavailable on phones | Full mode on a laptop; checklist mode on a phone; evaluate a WebGPU model for phones |
| The small model makes poor choices or loops | Deterministic playbook first, schema-validated actions, step budget, no-progress stop |
| Proprietary services invisible to the browser | Large known-UUID list; Canary-only scanning tools; report clearly |
| Encrypted or authenticated vendor protocols | Detect, record, raise a missing-tool request; never attempt to bypass |
| Unsafe motion commands | Approval per command, conservative values, emergency stop |
| API changes in Canary | Capability detection everywhere; an adapter layer around each API |

### Open questions

- Is a laptop acceptable for in-store use at MVP, or must phone mode ship with a real model?
- Which in-browser model, if any, for Android (size, speed, download cost on mobile data)?
- Should profiles be shareable publicly, to build a community device library later?
- Which vendor should be supported first after FTMS: Echelon or another?
- Should the app ever connect to the owner's own backend, or stay fully local?

### MVP acceptance criteria

- Given an FTMS treadmill that is powered on, when the person follows the agent's prompts, then
  Gattsby reports "Connected — FTMS" with speed and distance confirmed by live data.
- Given a heart-rate strap, Gattsby identifies the Heart Rate Service and shows live BPM.
- Given a device with only unknown services, Gattsby records raw data, identifies at least one
  varying field when the person changes effort, and returns "Partially decoded" or "Needs a missing
  tool" with evidence.
- Given no model is available, the same FTMS test passes in checklist mode.
- Given any control command, it is never sent without the person's explicit approval.
- Given a completed investigation, the profile can be exported as JSON and re-imported.

*Source: Chrome Prompt API documentation, checked 25 November 2026.*
