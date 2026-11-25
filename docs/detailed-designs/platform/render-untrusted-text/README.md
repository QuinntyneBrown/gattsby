# Render untrusted text

## Overview

Much of what Gattsby shows was written by something it does not control: the model's messages and
reasons, the name a device advertises, the bytes and strings a device returns, the person's own
answers and notes, files the person imports, and text the model reads from a photo. Any of them may
contain markup, script or control characters, by accident or by design. This feature makes every
such string inert: it is rendered as text, stored as data, and never evaluated, and the browser
itself refuses any attempt to turn a string into HTML or script. It belongs to the platform subsystem
and applies to every screen, the export and the import.

**untrusted text** — string whose content Gattsby did not author: model output, device names,
characteristic values, answers, imported files and text read from photos

**sink** — browser API that turns a string into markup or code, such as `innerHTML`, `eval`,
`new Function` or a script URL

**Trusted Types** — browser mechanism, enforced by the Content Security Policy directive
`require-trusted-types-for 'script'`, that refuses a plain string at a sink and accepts only a value
created by a named policy

Untrusted text appears on most screens: device names in the Investigation page's title and feed
(`docs/mocks/pages/investigation/identify.html`), model messages in the feed, hex and decoded values
in the Evidence log (`docs/mocks/pages/evidence/default.html`), maker and model on the Device profile
(`docs/mocks/pages/device-profile/default.html`), and imported profiles on the Saved devices page
(`docs/mocks/pages/profiles/default.html`).

The feature exists so that a hostile device name or a model output with a `<script>` tag cannot run
code in the page that holds the approval gate and the Bluetooth connection.

## Description

The design introduces these building blocks in the Angular (pending ADR 0001) workspace under
`frontend/src/app/`:

- **Templates** — every untrusted string is bound with interpolation (`{{ value }}`) or
  `[textContent]`. Angular escapes interpolated text, so markup appears literally. No template binds
  untrusted text to `[innerHTML]`, `[outerHTML]`, `[src]`, `[href]` or a style, and no code calls
  `DomSanitizer.bypassSecurityTrust*`.
- **`toDisplayText`** and **`toFileNamePart`** (`security/display-text.ts`) — pure helpers.
  `toDisplayText(value, maxLength)` removes C0 and C1 control characters and caps the length for
  display; the stored value is unchanged. `toFileNamePart(value)` keeps letters, digits and hyphens
  only, for export file names.
- **Bidirectional isolation** — components wrap device names and other untrusted inline text in
  `<bdi>`, so a right-to-left override inside a name cannot reorder the text around it.
- **`TrustedTypesPolicy`** (`security/trusted-types-policy.ts`) — installs Gattsby's one policy,
  `gattsby`, at bootstrap. It defines `createScriptURL` only, accepting same-origin URLs on an
  allowlist (the service worker script `/ngsw-worker.js`, and any worker a later design adds). It
  defines no `createHTML` and no `createScript`, so no Gattsby code can produce HTML or script from a
  string. Whether Angular's service worker registration passes through this policy or through
  Angular's own is `<TO SUPPLY>` until the workspace exists.
- **`SchemaValidator`** (`tools/schema-validator.ts`) — validates model actions, tool inputs and
  outputs, and imported files against JSON Schemas compiled to standalone code at build time, so no
  validator uses `eval` or `new Function` at run time. Schemas limit every string's length.
- **`ActionValidator`** (`agent/action-validator.ts`) — the only code that parses model output, with
  `JSON.parse`, then validates it (see the validate-every-action design).
- **`ImportService`** (`store/import-service.ts`) — refuses a file over 20 MB before parsing,
  refuses `__proto__`, `constructor` and `prototype` keys, then validates (see the
  import-profiles-and-records design).
- **`ExportService`** (`store/export-service.ts`) — writes strings as JSON data and builds file names
  with `toFileNamePart`.
- **Presentation components** — `ActivityFeed`, `PromptCard`, `ByteTable`, `VerdictSummary`,
  `ConfidenceBadge` and every page render untrusted text through the rules above. `ByteTable` renders
  bytes as hex, never decoded as markup.
- **Lint** — the framework's lint configuration refuses `eval`, implied `eval`, `new Function`, and
  `innerHTML` or `outerHTML` bindings and assignments; CI fails on a violation. The exact rule names
  are `<TO SUPPLY>` with ADR 0001.

### Sources and their handling

| Source | Arrives through | Stored as | Shown by |
|---|---|---|---|
| Model output | `ModelSession.promptAction` | Validated action fields, length-limited | Feed messages, hypothesis, missing-tool requests |
| Device name | `BleLayer` (`device.name`) | String | Title, feed, profile, history |
| Characteristic value | `BleLayer` read or notification | Bytes and hex; decoded strings (for example Device Information) as strings | `ByteTable`, profile |
| Person's answer or note | `PromptCard`, `AddNoteDialog` | String, at most 500 characters for answers | Feed, profile |
| Imported file | `ImportService` | Validated JSON | Saved devices, profile, history |
| Photo text | Model reading a photo (see the read-a-model-plate-photo design) | String | Photo dialog, feed |

### Content Security Policy

The headers file (see the serve-offline-and-private design) sets
`require-trusted-types-for 'script'` and `trusted-types angular gattsby`. With these, Chrome throws
when any code assigns a plain string to an HTML or script sink, even through a third-party
library. `script-src 'self'` without `'unsafe-eval'` blocks `eval` and `new Function` outright.

### Tests that prove it

The fake `navigator.bluetooth` scripts a device named `<img src=x onerror=alert(1)>`; the fake
`LanguageModel` returns a message containing `<script>alert(1)</script>`. The behaviour spec runs the
investigation, exports the record, re-imports it, and checks through the page objects that the text
appears literally on the Investigation, Verdict, Device profile and Saved devices pages. The shared
fixture fails the spec on any `dialog` event, `pageerror` or `securitypolicyviolation`. The specs run
against the production build served with its Content Security Policy, so a Trusted Types violation
anywhere fails them (NFR-013). Unit tests cover `toDisplayText` and `toFileNamePart` for control
characters, bidirectional overrides and markup.

## Requirements

The feature realizes the following level-2 (L2) requirements; each refines the level-1 (L1)
requirement cited beside it.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| [`NFR-013`](../../../specs/L2.md#nfr-013-treat-model-output-and-device-data-as-untrusted) | `L1-018` | Model output, device names, characteristic values, answers, imported files and text read from photos must be rendered as text, never as HTML, and never evaluated. The app must enforce Trusted Types (`require-trusted-types-for 'script'`) and contain no `innerHTML`, `eval` or `new Function` on such data. |

## Diagrams

### System context

Device names and values, model output, the person's text and imported files all reach Gattsby as
untrusted text; Gattsby shows them literally, and the host's headers make Chrome enforce it.

![C4 system context for rendering untrusted text](diagrams/c4-context.png)

### Containers

The web app renders untrusted strings by interpolation and stores them unchanged as data; Chrome's
Trusted Types enforcement blocks any string that reaches an HTML or script sink.

![C4 container view for rendering untrusted text](diagrams/c4-container.png)

### Components

Every source of untrusted text passes through a validator or straight to presentation components that
use interpolation, `<bdi>` and `toDisplayText`; `TrustedTypesPolicy` registers the one policy Gattsby
needs.

![C4 component view for rendering untrusted text](diagrams/c4-component.png)

### Class structure

`ActionValidator` and `ImportService` share the precompiled `SchemaValidator`; the presentation
components and `ExportService` format text through the `DisplayText` helpers; `TrustedTypesPolicy`
accepts no untrusted source.

![Class diagram for rendering untrusted text](diagrams/class-structure.png)

### Behaviour — show hostile text literally, through export and import

A device name with an `<img onerror>` tag and model output with a `<script>` tag are shown as text,
exported as JSON data under a safe file name, and shown as text again after import.

![Sequence diagram for showing hostile text literally](diagrams/sequence-show-hostile-text.png)

### Behaviour — block a string that reaches an HTML sink

Chrome throws when a plain string reaches `innerHTML`, and the spec fails; the `gattsby` policy
creates a script URL only for its same-origin allowlist.

![Sequence diagram for blocking a string at an HTML sink](diagrams/sequence-block-an-html-sink.png)
