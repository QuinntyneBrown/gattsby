# Gattsby mocks

Static HTML mocks of every Gattsby screen, dialog and notification, in every state. They are the
source of truth for the UI (see [`AGENTS.md`](../../AGENTS.md#sources-of-truth)): requirements,
ADRs, detailed designs and code follow them.

They were drawn from the Magic Patterns project **Bluetooth Device Investigator** (the *Gattsby App*
prototype with its eight frames, and the *Gattsby Brand* logo and wordmark), then completed and
aligned with [`docs/specs/L2.md`](../specs/L2.md). Where the two disagreed, the requirement won; each
difference is listed under [Departures from the Magic Patterns designs](#departures-from-the-magic-patterns-designs).

## Opening the mocks

- Open [`index.html`](index.html) straight from disk. No server, build or network is needed: fonts
  (Geist and Geist Mono, SIL Open Font License, in `../design-system/assets/fonts/`) and images are bundled.
- Every mock has a bar at the bottom with its sibling states, a theme toggle and a button that hides
  the mock chrome. Press `t` to switch theme.
- `?theme=dark` or `?theme=light` forces a theme; `?chrome=0` hides the bar and the yellow notes, so
  the page looks exactly like the product.
- Every mock is responsive. Check them at 360, 768, 992 and 1280 px; from 992 px the investigation
  puts the prompt and live readings beside the activity feed (NFR-010).

## Layout of this folder

```
docs/mocks/
  README.md            this file: cast, decisions, coverage matrix (generated section)
  index.html           gallery of every screen and state (generated)
  manifest.json        screens, states, routes and requirement IDs
  assets/tokens.css    imports ../design-system/tokens/tokens.css (the design tokens)
  assets/ui.css        imports ../design-system/assets/components.css (the component kit)
  assets/mock.css      mock bar and notes (not product UI)
  assets/mock.js       theme and chrome switches
  assets/img/          the model-plate photo used in notes and the photo dialog
  pages/<id>/<state>.html
  dialogs/<id>/<state>.html          shown over the page they open from
  notifications/<id>/<state>.html    shown on the page that raises them
```

## Cast and catalog

Every mock tells the same story. Reuse these when adding a mock.

- **Today** is Wednesday 25 November 2026, about 14:40. The person is a developer standing beside a
  treadmill at **Decathlon, Lille**, using Chrome 148 on a MacBook (full agent mode, Gemini Nano
  ready, advertisement scanning not available).
- **The main investigation**: Horizon T202 treadmill by Johnson Health Tech, advertised as
  `HZN-T202-4F1A`, firmware 2.14.0, services `0x1826 0x180A 0x180D 0xFFF0`. Three look-alike
  neighbours: `HZN-T202-77C0`, `HZN-T202-0B9E` and an unnamed FTMS device. Started 14:26, verdict
  *Connected — FTMS* after 11 steps and 412 packets. Control test: request control, then
  set target speed 6.0 → 5.9 km/h (`02 4E 02`), then stop (`08 01`).
- **Paused investigation**: a spin bike at Basic-Fit Roubaix, advertised as `SB-7731`, paused at the
  Standard path 2 hours ago (hypothesis *FTMS indoor bike*, 70%).
- **Saved devices** (6): Horizon T202 (Today), Polar H10 (Garage, Sun 22 Nov), Schwinn IC4
  (Basic-Fit Roubaix, Thu 19 Nov), Concept2 RowErg (CrossFit Fives, Sat 14 Nov, *Partially decoded*),
  `KS-AP-R3`, a likely Kingsmith (Boulanger, Lomme, Tue 10 Nov, *Needs a missing tool*), Technogym
  Skillrun (Fitness Park Lille, Tue 3 Nov, *Not connectable*).
- **Past investigations** (8): the six above, the paused spin bike, and Domyos T540C (Decathlon,
  Lille, Wed 28 Oct, *Stopped by the person*).
- **Missing-tool requests**: decrypt Kingsmith FE00 packets (2 devices), Concept2 PM5 stroke-data
  decoder (1), compare two notification streams by time offset (3), read the Cycling Power vector
  field (built).
- **Storage**: 8 investigations, 6 profiles, 3 photos, 14.2 MB. App 0.1.0, knowledge base 2026.11,
  profile format 1.

## Visual language

From the Magic Patterns *Gattsby Brand* prototype: **ink** `#15171B`, **paper** `#F3F1EA` and
**signal** `#FF5A1F`, set in **Geist** (Geist Mono for bytes, UUIDs and numbers). The mark is an open
G drawn as a scan arc whose crossbar stops short of a dot, the unknown device. Light theme is paper;
dark theme is ink. Primary actions are ink (paper in dark); signal marks what is live (the current
stage, the Live dot, missing-tool requests). Confidence is always a word plus a shape: filled =
confirmed, half = likely, ring = guess, dashed = claimed only.

## Departures from the Magic Patterns designs

Each change below was made so the mocks satisfy a requirement or a rule in `AGENTS.md`.

| Magic Patterns | Mocks | Why |
|---|---|---|
| "Phone mode" | "Checklist mode" | The specs' word (FR-005, FR-049); AGENTS.md forbids synonyms. |
| Stages Context, Discovery, Connection, Fingerprinting, Active probing, Control testing | Prepare, Find, Identify, Standard path, Proprietary path, Control, Conclude | The playbook's seven stages (brief, FR-049). The unused path shows as skipped. |
| "Best guess", "probes" | "Hypothesis", "steps" | Spec words. |
| Tool chips `scan`, `listen`, `compare`… | `scan_devices`, `subscribe_and_record`, `decode_standard`… | The tool registry's names (TOOL-002 to TOOL-030). |
| Red "Stop" in the bar | "Emergency stop", also inside every dialog over a connected investigation | FR-039: reachable in one tap even while an approval is pending; the page behind a dialog is inert. |
| Danger red `#C62A2A` | `#A11D1D` | The emergency stop needs 7:1 contrast with its label (NFR-011). |
| Buttons 36–44 px, chips 32 px | Every target 48 px | AGENTS.md and NFR-009. |
| Prompt title 16 px, live values 15 px | 20 px prompt, 32 px live values on phones | NFR-009, readable at arm's length. |
| Side panel from 1024 px; prompt under the feed | From 992 px the prompt and live readings sit beside the feed | NFR-010 breakpoints and AC3. |
| Agent scans and lists candidates with signal strengths | Chrome's chooser lists them; the person picks the one that returns after a power cycle | A page can't see Chrome's chooser list or RSSI without advertisement scanning (PD-ADV), which the default readiness reports as unavailable (FR-001 AC1, FR-013). |
| "Run it / Skip" before reading device information | A running step: "Reading the maker and model" | Read-only steps run without a prompt; FR-048 AC1. |
| Approval: "Send command / Don't send", no checkbox | "Send / Don't send", risk shown, "I am clear and know where the stop is" must be ticked | FR-034, FR-035. |
| Command: slow the belt to 4.0 km/h | Lower the target to 5.9 km/h (the smallest step) | FR-036: change one value by the smallest step. |
| Verdict "Connected"; "Save device profile" | "Connected — FTMS"; Export profile, Export full record, New investigation | FR-054, FR-057; the profile is already saved as the investigation runs (FR-060). |
| Export: "Include notes and photos" ticked | Unticked | FR-063: photos are excluded by default. |
| Menu: Go back a step, Restart investigation | Pause, note or location, photo, evidence, stop | No requirement asks for going back or restarting. |
| Readiness: Browser, Bluetooth, On-device AI | Browser, Bluetooth, On-device model, Advertisement scanning, Camera, Storage, each with *Available*, *Needs action* or *Not available* | FR-001. |
| Model-plate photo from a CDN | Bundled illustration | Mocks open offline; the app makes no third-party requests (NFR-012). |
| FTMS bytes in the evidence log | Re-encoded to the real Treadmill Data layout (flags `0x040C`) | The audience reads the hex. |

Screens with no Magic Patterns frame were added from the specs: past investigations (FR-061),
settings with delete all data (FR-005, FR-065), import (FR-064), the photo-read dialog (FR-022, P2),
stop and leave confirmations (FR-009, FR-018), the connection and mode banners (FR-006, FR-016),
toasts, readiness states for model download, insecure context and blocked storage (FR-003, FR-004),
and a not-found page.

Later states added from the specs: the three “can’t find it” checks (FR-014), a metric that didn’t
follow the console (FR-025), a recording in progress (FR-028, FR-051), storage full mid-recording
(NFR-008), checking a command’s effect (FR-038), and the vendor-handshake approval (FR-032, P2).
Past investigations now show storage use (NFR-008).

## Open questions and assumptions

1. **Behaviour Description.** Every user-facing string is provisional until the companion
   *Gattsby: Behavior Description* lands in `docs/behavior.md` (OQ-06). The mocks then follow it.
2. **Phone layout of the investigation app bar.** At 360 px the bar holds Back, the title, Options
   and Emergency stop; Pause moves into the options sheet. Confirm this is acceptable beside a
   machine.
3. **Signal orange as the current-stage segment** reaches 2.76:1 on paper, under the 3:1 for
   non-text contrast. It is kept because the stage name is always shown in text beside it (app bar
   subtitle, track label); confirm or switch to `--color-fg-signal`.
4. **Observation confidence** uses *confirmed*, *likely* and *guess* (from the designs); metric and
   control status uses the specs' *confirmed*, *claimed only* and *claimed, not seen*. Confirm both
   vocabularies are wanted.
5. **Control in a store** (OQ-08): the control stage is drawn as optional and skippable; whether it
   runs in stores at all is open.
6. **Model size.** The download is shown as 2.2 GB, from the designs; Chrome reports the real size.
7. **Export file names** use `<device>-<date>-profile.gattsby.json` and `…-record.gattsby.json`,
   matching the `*.gattsby.json` pattern in `.gitignore`.
8. **Phase.** The photo-read dialog (FR-022), automatic candidate matching (FR-013) and the vendor
   handshake (FR-032) are P2; they are drawn now so the layout has room for them. The Kingsmith
   handshake bytes (`F7 A2 00 00 A2 FD` to `0xFE02`) are illustrative until the knowledge base holds
   a sourced entry (FR-068).
9. **App update prompt.** The app is a PWA (NFR-006), so a new version reaches the person through
   the service worker. No requirement says whether Gattsby tells them; no update banner is drawn
   until one does.

## Re-checking and re-screenshotting

```sh
python .claude/skills/writing-html-mocks/scripts/check_mocks.py docs/mocks --write   # gallery, coverage, checks
python .claude/skills/writing-html-mocks/scripts/screenshot_mocks.py docs/mocks     # PNGs in docs/mocks/.cache (never commit)
```

## Design system

The tokens, component styles and fonts now live in [`docs/design-system/`](../design-system/README.md), extracted
from these mocks on 25 November 2026. The two files in `assets/` only import them, so every mock and the design
system always agree. When a mock needs a style or component the system lacks, add it to the design system first,
then use it here. The extraction snapped 6, 10 and 14px spacing to the 4px grid and gave invalid edges and the
emergency stop a red-300 outline in dark; the design system's README lists every change.

## Coverage

<!-- coverage:start -->

Legend: ✅ mock exists · ➖ not applicable (reason in manifest) · ❌ missing

### Pages

| Screen | default | loading | empty | error | checklist | downloadable | downloading | download-failed | bluetooth-off | permission-denied | unsupported | insecure | prepare | find | find-candidates | find-report-candidates | find-watch-candidates | find-power-cycle | find-cancelled | cannot-find | cannot-find-connections | cannot-find-range | cannot-find-final-scan | identify | model-decision | model-refusal | not-confirmed | proprietary | recording | storage-full | control | control-check | held-by-other | partial | missing-tool | not-connectable | stopped | success | filtered | no-results | Requirements |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Readiness check (`readiness`) | [✅](pages/readiness/default.html) | [✅](pages/readiness/loading.html) | ➖ | [✅](pages/readiness/error.html) | [✅](pages/readiness/checklist.html) | [✅](pages/readiness/downloadable.html) | [✅](pages/readiness/downloading.html) | [✅](pages/readiness/download-failed.html) | [✅](pages/readiness/bluetooth-off.html) | [✅](pages/readiness/permission-denied.html) | [✅](pages/readiness/unsupported.html) | [✅](pages/readiness/insecure.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `FR-001`, `FR-002`, `FR-003`, `FR-004`, `FR-005`, `NFR-016`, `NFR-025` |
| Home (`home`) | [✅](pages/home/default.html) | [✅](pages/home/loading.html) | [✅](pages/home/empty.html) | [✅](pages/home/error.html) | [✅](pages/home/checklist.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `FR-005`, `FR-007`, `FR-009`, `FR-059`, `FR-061`, `NFR-012` |
| Investigation (`investigation`) | [✅](pages/investigation/default.html) | [✅](pages/investigation/loading.html) | ➖ | [✅](pages/investigation/error.html) | [✅](pages/investigation/checklist.html) |  |  |  |  |  |  |  | [✅](pages/investigation/prepare.html) | [✅](pages/investigation/find.html) | [✅](pages/investigation/find-candidates.html) | [✅](pages/investigation/find-report-candidates.html) | [✅](pages/investigation/find-watch-candidates.html) | [✅](pages/investigation/find-power-cycle.html) | [✅](pages/investigation/find-cancelled.html) | [✅](pages/investigation/cannot-find.html) | [✅](pages/investigation/cannot-find-connections.html) | [✅](pages/investigation/cannot-find-range.html) | [✅](pages/investigation/cannot-find-final-scan.html) | [✅](pages/investigation/identify.html) | [✅](pages/investigation/model-decision.html) | [✅](pages/investigation/model-refusal.html) | [✅](pages/investigation/not-confirmed.html) | [✅](pages/investigation/proprietary.html) | [✅](pages/investigation/recording.html) | [✅](pages/investigation/storage-full.html) | [✅](pages/investigation/control.html) | [✅](pages/investigation/control-check.html) | [✅](pages/investigation/held-by-other.html) |  |  |  |  |  |  |  | `FR-005`, `FR-008`, `FR-011`, `FR-012`, `FR-013`, `FR-014`, `FR-015`, `FR-017`, `FR-024`, `FR-025`, `FR-026`, `FR-028`, `FR-038`, `FR-039`, `FR-048`, `FR-049`, `FR-050`, `FR-051`, `FR-052`, `FR-053`, `NFR-005`, `NFR-008`, `NFR-009`, `NFR-010`, `NFR-025` |
| Verdict (`verdict`) | [✅](pages/verdict/default.html) | [✅](pages/verdict/loading.html) | ➖ | [✅](pages/verdict/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/verdict/partial.html) | [✅](pages/verdict/missing-tool.html) | [✅](pages/verdict/not-connectable.html) | [✅](pages/verdict/stopped.html) |  |  |  | `FR-009`, `FR-014`, `FR-018`, `FR-033`, `FR-054`, `FR-056`, `FR-057`, `FR-058`, `FR-060`, `FR-062`, `FR-063` |
| Device profile (`device-profile`) | [✅](pages/device-profile/default.html) | [✅](pages/device-profile/loading.html) | ➖ | [✅](pages/device-profile/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/device-profile/partial.html) |  |  |  | [✅](pages/device-profile/success.html) |  |  | `FR-010`, `FR-023`, `FR-027`, `FR-040`, `FR-055`, `FR-062` |
| Evidence log (`evidence`) | [✅](pages/evidence/default.html) | [✅](pages/evidence/loading.html) | [✅](pages/evidence/empty.html) | [✅](pages/evidence/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/evidence/filtered.html) | [✅](pages/evidence/no-results.html) | `FR-056`, `FR-073`, `NFR-013` |
| Saved devices (`profiles`) | [✅](pages/profiles/default.html) | [✅](pages/profiles/loading.html) | [✅](pages/profiles/empty.html) | [✅](pages/profiles/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/profiles/filtered.html) | [✅](pages/profiles/no-results.html) | `FR-002`, `FR-055`, `FR-061`, `FR-064` |
| Past investigations (`history`) | [✅](pages/history/default.html) | [✅](pages/history/loading.html) | [✅](pages/history/empty.html) | [✅](pages/history/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `FR-009`, `FR-061`, `NFR-008` |
| Missing tools (`missing-tools`) | [✅](pages/missing-tools/default.html) | [✅](pages/missing-tools/loading.html) | [✅](pages/missing-tools/empty.html) | [✅](pages/missing-tools/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `FR-033`, `FR-058`, `FR-059` |
| Settings (`settings`) | [✅](pages/settings/default.html) | [✅](pages/settings/loading.html) | ➖ | [✅](pages/settings/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `FR-005`, `FR-064`, `FR-065`, `NFR-008`, `NFR-012` |
| Not found (`not-found`) | [✅](pages/not-found/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `FR-064` |

### Dialogs

| Screen | default | busy | invalid | confirmed | failed | stop | request-control | handshake | paused | released | unavailable | success | confirm | Requirements |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Approve a command (`approval`) | [✅](dialogs/approval/default.html) | [✅](dialogs/approval/busy.html) | ➖ | [✅](dialogs/approval/confirmed.html) | [✅](dialogs/approval/failed.html) | [✅](dialogs/approval/stop.html) | [✅](dialogs/approval/request-control.html) | [✅](dialogs/approval/handshake.html) |  |  |  |  |  | `FR-032`, `FR-033`, `FR-034`, `FR-035`, `FR-036`, `FR-037`, `FR-038`, `FR-039`, `NFR-018` |
| Emergency stop (`emergency-stop`) | [✅](dialogs/emergency-stop/default.html) | [✅](dialogs/emergency-stop/busy.html) | ➖ |  | [✅](dialogs/emergency-stop/failed.html) |  |  |  |  |  |  |  |  | `FR-039` |
| Unexpected response (`unexpected-effect`) | [✅](dialogs/unexpected-effect/default.html) | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  | `FR-038`, `FR-039` |
| Still there? / Paused (`still-there`) | [✅](dialogs/still-there/default.html) | ➖ | ➖ |  |  |  |  |  | [✅](dialogs/still-there/paused.html) | [✅](dialogs/still-there/released.html) |  |  |  | `FR-009`, `FR-051` |
| Investigation options (`investigation-menu`) | [✅](dialogs/investigation-menu/default.html) | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  | `FR-009`, `FR-010`, `FR-022`, `FR-056` |
| Add a note or the location (`add-note`) | [✅](dialogs/add-note/default.html) | ➖ | [✅](dialogs/add-note/invalid.html) |  |  |  |  |  |  |  |  |  |  | `FR-010` |
| Read the model plate (`photo-read`) | [✅](dialogs/photo-read/default.html) | [✅](dialogs/photo-read/busy.html) | [✅](dialogs/photo-read/invalid.html) |  |  |  |  |  |  |  | [✅](dialogs/photo-read/unavailable.html) |  |  | `FR-022`, `NFR-017` |
| Stop the investigation (`stop-investigation`) | [✅](dialogs/stop-investigation/default.html) | [✅](dialogs/stop-investigation/busy.html) | ➖ |  |  |  |  |  |  |  |  |  |  | `FR-009`, `FR-018` |
| Leave the investigation (`leave-investigation`) | [✅](dialogs/leave-investigation/default.html) | [✅](dialogs/leave-investigation/busy.html) | ➖ |  |  |  |  |  |  |  |  |  |  | `FR-018`, `FR-060` |
| Export (`export`) | [✅](dialogs/export/default.html) | [✅](dialogs/export/busy.html) | ➖ |  |  |  |  |  |  |  |  | [✅](dialogs/export/success.html) |  | `FR-062`, `FR-063`, `NFR-012` |
| Import (`import`) | [✅](dialogs/import/default.html) | [✅](dialogs/import/busy.html) | [✅](dialogs/import/invalid.html) |  | [✅](dialogs/import/failed.html) |  |  |  |  |  |  | [✅](dialogs/import/success.html) |  | `FR-064`, `NFR-015` |
| Delete an investigation (`delete-investigation`) | [✅](dialogs/delete-investigation/default.html) | [✅](dialogs/delete-investigation/busy.html) | ➖ |  |  |  |  |  |  |  |  |  |  | `FR-061` |
| Delete all data (`delete-all-data`) | [✅](dialogs/delete-all-data/default.html) | [✅](dialogs/delete-all-data/busy.html) | [✅](dialogs/delete-all-data/invalid.html) |  |  |  |  |  |  |  |  |  | [✅](dialogs/delete-all-data/confirm.html) | `FR-065` |

### Notifications

| Screen | info | success | warning | danger | stacked | Requirements |
|---|---|---|---|---|---|---|
| Connection banner (`connection-banner`) | [✅](notifications/connection-banner/info.html) | [✅](notifications/connection-banner/success.html) | [✅](notifications/connection-banner/warning.html) | [✅](notifications/connection-banner/danger.html) |  | `FR-015`, `FR-016`, `NFR-007` |
| Mode banner (`mode-banner`) | [✅](notifications/mode-banner/info.html) | ➖ | [✅](notifications/mode-banner/warning.html) | ➖ |  | `FR-005`, `FR-006` |
| Toast (`toast`) | [✅](notifications/toast/info.html) | [✅](notifications/toast/success.html) | [✅](notifications/toast/warning.html) | [✅](notifications/toast/danger.html) | [✅](notifications/toast/stacked.html) | `FR-062`, `NFR-008` |

<!-- coverage:end -->
