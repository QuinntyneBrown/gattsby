# Gattsby design system

Extracted from [docs/mocks](../mocks/README.md) on 25 November 2026. Open [index.html](index.html) locally; no server or network is needed.

The design system is now the single source of the UI’s tokens and component styles. The mocks read it:
`docs/mocks/assets/tokens.css` imports [tokens/tokens.css](tokens/tokens.css) and `docs/mocks/assets/ui.css`
imports [assets/components.css](assets/components.css). The fonts moved to `assets/fonts/`. Under
[AGENTS.md](../../AGENTS.md#sources-of-truth) the mocks stay the source of truth for every screen; when a mock
needs a style or component this system lacks, add it here, then use it in the mock.

## Foundations

| Page | Covers |
|---|---|
| [Color](foundations/color.html) | Ink, paper and signal; roles, both themes, every checked contrast pair. |
| [Typography](foundations/typography.html) | Geist and Geist Mono; the scale, roles, prompt and metric sizes. |
| [Spacing](foundations/spacing.html) | The 4px scale and the inside/between rules. |
| [Layout](foundations/layout.html) | NFR-010 breakpoints, columns, gutters, margins and page templates. |
| [Elevation](foundations/elevation.html) | Shadows, the surface hierarchy and z-order. |
| [Shape](foundations/shape.html) | Radii and border widths, and which size takes which radius. |
| [Motion](foundations/motion.html) | Durations, easings, loops and reduced motion. |
| [Iconography](foundations/iconography.html) | The 24-unit, 2px-stroke icon set used in the mocks. |
| [Theming](foundations/theming.html) | Paper and ink themes, token tiers, adding a theme, tokens.json. |
| [Responsive](foundations/responsive.html) | Mobile first, one-handed use, behaviour per breakpoint. |
| [Accessibility](foundations/accessibility.html) | WCAG 2.2 AA commitments and how they are tested. |
| [Content](foundations/content.html) | Voice, the specs' words, numbers, bytes, errors and microcopy. |

## Components

| Component | Group | Source mocks |
|---|---|---|
| [Button](components/button.html) | Actions | [pages/investigation/default](../mocks/pages/investigation/default.html), [dialogs/approval/default](../mocks/dialogs/approval/default.html), [dialogs/approval/busy](../mocks/dialogs/approval/busy.html) |
| [Emergency stop](components/emergency-stop.html) | Actions | [pages/investigation/default](../mocks/pages/investigation/default.html), [dialogs/approval/default](../mocks/dialogs/approval/default.html), [dialogs/emergency-stop/default](../mocks/dialogs/emergency-stop/default.html) |
| [Link](components/link.html) | Actions | [pages/home/default](../mocks/pages/home/default.html), [pages/investigation/default](../mocks/pages/investigation/default.html), [dialogs/add-note/invalid](../mocks/dialogs/add-note/invalid.html) |
| [Chip](components/chip.html) | Actions | [pages/profiles/filtered](../mocks/pages/profiles/filtered.html), [pages/investigation/identify](../mocks/pages/investigation/identify.html), [pages/investigation/checklist](../mocks/pages/investigation/checklist.html) |
| [Menu](components/menu.html) | Actions | [dialogs/investigation-menu/default](../mocks/dialogs/investigation-menu/default.html), [dialogs/export/default](../mocks/dialogs/export/default.html) |
| [Text field](components/text-field.html) | Inputs | [dialogs/add-note/default](../mocks/dialogs/add-note/default.html), [dialogs/add-note/invalid](../mocks/dialogs/add-note/invalid.html), [dialogs/photo-read/default](../mocks/dialogs/photo-read/default.html) |
| [Checkbox](components/checkbox.html) | Inputs | [dialogs/approval/default](../mocks/dialogs/approval/default.html), [dialogs/export/default](../mocks/dialogs/export/default.html) |
| [Switch](components/switch.html) | Inputs | [pages/settings/default](../mocks/pages/settings/default.html) |
| [File upload](components/file-upload.html) | Inputs | [dialogs/import/default](../mocks/dialogs/import/default.html), [dialogs/import/invalid](../mocks/dialogs/import/invalid.html), [dialogs/add-note/default](../mocks/dialogs/add-note/default.html) |
| [App bar](components/app-bar.html) | Navigation | [pages/investigation/default](../mocks/pages/investigation/default.html), [pages/home/default](../mocks/pages/home/default.html), [pages/verdict/default](../mocks/pages/verdict/default.html) |
| [Stage track](components/stage-track.html) | Navigation | [pages/investigation/default](../mocks/pages/investigation/default.html), [pages/investigation/proprietary](../mocks/pages/investigation/proprietary.html) |
| [Skip link](components/skip-link.html) | Navigation | [pages/home/default](../mocks/pages/home/default.html) |
| [Layout primitives](components/layout.html) | Containers | [pages/home/default](../mocks/pages/home/default.html), [pages/verdict/default](../mocks/pages/verdict/default.html), [pages/readiness/default](../mocks/pages/readiness/default.html) |
| [Card](components/card.html) | Containers | [pages/home/default](../mocks/pages/home/default.html), [pages/verdict/missing-tool](../mocks/pages/verdict/missing-tool.html), [dialogs/leave-investigation/default](../mocks/dialogs/leave-investigation/default.html) |
| [Dialog](components/dialog.html) | Containers | [dialogs/approval/default](../mocks/dialogs/approval/default.html), [dialogs/emergency-stop/default](../mocks/dialogs/emergency-stop/default.html), [dialogs/export/default](../mocks/dialogs/export/default.html) |
| [Brand](components/brand.html) | Data display | [pages/home/default](../mocks/pages/home/default.html), [pages/readiness/default](../mocks/pages/readiness/default.html) |
| [Badge](components/badge.html) | Data display | [pages/investigation/default](../mocks/pages/investigation/default.html), [pages/device-profile/default](../mocks/pages/device-profile/default.html), [pages/missing-tools/default](../mocks/pages/missing-tools/default.html) |
| [Verdict mark](components/verdict-mark.html) | Data display | [pages/profiles/default](../mocks/pages/profiles/default.html), [pages/verdict/default](../mocks/pages/verdict/default.html), [pages/history/default](../mocks/pages/history/default.html) |
| [Row list](components/row-list.html) | Data display | [pages/home/default](../mocks/pages/home/default.html), [pages/profiles/default](../mocks/pages/profiles/default.html), [pages/history/default](../mocks/pages/history/default.html) |
| [Key-value list](components/key-value.html) | Data display | [pages/device-profile/default](../mocks/pages/device-profile/default.html), [pages/investigation/default](../mocks/pages/investigation/default.html), [pages/evidence/default](../mocks/pages/evidence/default.html) |
| [Data table](components/data-table.html) | Data display | [pages/device-profile/default](../mocks/pages/device-profile/default.html) |
| [Code and bytes](components/code.html) | Data display | [dialogs/approval/default](../mocks/dialogs/approval/default.html), [pages/readiness/unsupported](../mocks/pages/readiness/unsupported.html) |
| [Live reading](components/live-reading.html) | Investigation | [pages/investigation/default](../mocks/pages/investigation/default.html), [pages/investigation/control](../mocks/pages/investigation/control.html) |
| [Activity feed](components/activity-feed.html) | Investigation | [pages/investigation/default](../mocks/pages/investigation/default.html), [pages/investigation/loading](../mocks/pages/investigation/loading.html) |
| [Tool call](components/tool-call.html) | Investigation | [pages/investigation/default](../mocks/pages/investigation/default.html), [pages/investigation/proprietary](../mocks/pages/investigation/proprietary.html) |
| [Prompt dock](components/prompt-dock.html) | Investigation | [pages/investigation/default](../mocks/pages/investigation/default.html), [pages/investigation/identify](../mocks/pages/investigation/identify.html), [pages/investigation/checklist](../mocks/pages/investigation/checklist.html) |
| [Readiness check](components/readiness-check.html) | Investigation | [pages/readiness/default](../mocks/pages/readiness/default.html), [pages/readiness/downloading](../mocks/pages/readiness/downloading.html), [pages/readiness/bluetooth-off](../mocks/pages/readiness/bluetooth-off.html) |
| [Evidence entry](components/evidence-entry.html) | Investigation | [pages/evidence/default](../mocks/pages/evidence/default.html), [pages/evidence/filtered](../mocks/pages/evidence/filtered.html), [pages/evidence/no-results](../mocks/pages/evidence/no-results.html) |
| [Missing-tool request](components/missing-tool-request.html) | Investigation | [pages/missing-tools/default](../mocks/pages/missing-tools/default.html), [pages/verdict/missing-tool](../mocks/pages/verdict/missing-tool.html) |
| [Progress and meter](components/progress.html) | Feedback | [pages/readiness/downloading](../mocks/pages/readiness/downloading.html), [pages/investigation/default](../mocks/pages/investigation/default.html) |
| [Spinner](components/spinner.html) | Feedback | [notifications/connection-banner/warning](../mocks/notifications/connection-banner/warning.html), [pages/readiness/loading](../mocks/pages/readiness/loading.html) |
| [Skeleton](components/skeleton.html) | Feedback | [pages/home/loading](../mocks/pages/home/loading.html), [pages/investigation/loading](../mocks/pages/investigation/loading.html) |
| [Alert and banner](components/alert.html) | Feedback | [notifications/connection-banner/warning](../mocks/notifications/connection-banner/warning.html), [notifications/connection-banner/danger](../mocks/notifications/connection-banner/danger.html), [notifications/mode-banner/warning](../mocks/notifications/mode-banner/warning.html) |
| [Toast](components/toast.html) | Feedback | [notifications/toast/success](../mocks/notifications/toast/success.html), [notifications/toast/danger](../mocks/notifications/toast/danger.html), [notifications/toast/stacked](../mocks/notifications/toast/stacked.html) |
| [Empty and error state](components/empty-state.html) | Feedback | [pages/profiles/empty](../mocks/pages/profiles/empty.html), [pages/profiles/error](../mocks/pages/profiles/error.html), [pages/profiles/no-results](../mocks/pages/profiles/no-results.html) |

Every component page has the same thirteen sections: overview, anatomy, variants, sizes, states (with both
themes side by side), responsive behaviour, theming, accessibility, content, do and don't, tokens, code and
sources.

## Patterns

| Pattern | Covers |
|---|---|
| [Approvals and safety](patterns/approvals-and-safety.html) | Approval sheets, the stand-clear reminder, lowest risk first, the emergency stop. |
| [Investigation layout](patterns/investigation-layout.html) | Feed, prompt, live readings and panel at each breakpoint. |
| [Forms](patterns/forms.html) | Labels, help, validation timing, error summary, submit states. |
| [Feedback and loading](patterns/feedback-and-loading.html) | Inline, banner, toast or sheet; skeleton, spinner or progress. |
| [Empty and error states](patterns/empty-and-error-states.html) | First run, no results, failures, not found. |
| [Navigation and page structure](patterns/navigation.html) | App bar, back, the options sheet, page widths. |
| [Dialogs and overlays](patterns/dialogs-and-overlays.html) | Bottom sheets, centred dialogs, stacking, inert pages. |
| [Data tables and lists](patterns/data-tables-and-lists.html) | Rows, key-value lists, tables, filters and search. |
| [Notifications](patterns/notifications.html) | Toast versus banner, priority, timing and dismissal. |
| [Content and tone](patterns/content-and-tone.html) | Voice, the specs' words, button verbs, numbers and bytes. |

## Tokens

- [tokens/tokens.css](tokens/tokens.css): the source of truth. Primitives (`--palette-*`, `--font-*`), semantic
  roles (`--color-*`, `--text-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--duration-*`, `--ease-*`, `--z-*`,
  `--layout-*`, `--target-*`, `--control-height-*`), the paper (light) and ink (dark) themes, and the
  reduced-motion, more-contrast and forced-colours overrides.
- [tokens/tokens.json](tokens/tokens.json): W3C DTCG export, generated from `tokens.css`.
- [tokens/contrast-pairs.json](tokens/contrast-pairs.json): every foreground/background pairing the components
  rely on, checked in both themes.
- [assets/components.css](assets/components.css): every component class, token-driven, with `data-state` hooks.
- [assets/ds.css](assets/ds.css) and [assets/ds.js](assets/ds.js): documentation chrome only (theme toggle, live
  token values and contrast ratios); never used by the product or the mocks.

Decisions carried over from the mocks, each for a requirement: the danger solid is #A11D1D so the emergency-stop
label holds 7:1 (FR-039, NFR-011); every control is at least 48px (NFR-009); the prompt is 20px and live
readings 32px (NFR-009); breakpoints are NFR-010's 576, 768, 992 and 1200px.

## Drift found in the mocks

| Mock | Issue | Resolution |
|---|---|---|
| assets/ui.css (most mocks) | Spacing of 6, 10 and 14px (<code>--space-1-5</code>, <code>-2-5</code>, <code>-3-5</code>) off the 4px grid. | Removed the half steps; snapped up to 8, 12 and 16px. Most screens grow by a few pixels (before/after screenshots compared). |
| assets/ui.css | Dialog, toast and action-bar queries at 40rem (640px) and sidebar/top-bar queries at 64rem (1024px), not the NFR-010 breakpoints. | 40rem → 36rem (576px); the 64rem rules belonged to unused kit parts and were removed. |
| assets/ui.css | Four <code>max-width: 47.99rem</code> queries (stop label, readiness actions, hidden words, stepper). | Rewritten mobile first with <code>min-width: 48rem</code>; the stepper was unused and removed. |
| assets/ui.css | Raw loop durations 0.8 s, 1.4 s, 1.6 s and a raw <code>linear</code>. | New tokens <code>--duration-spin</code>, <code>--duration-shimmer</code>, <code>--duration-pulse</code>, <code>--ease-linear</code>. |
| assets/ui.css | Raw font sizes 1.375rem (brand), 1.625rem (large brand), 2.125rem (verdict on phones), 0.8125rem (identity values, bytes), 0.875rem (feed avatar). | Snapped to the scale: <code>--font-size-xl</code>, <code>-2xl</code>, <code>-2xl</code>, <code>-sm</code> (via <code>--text-code</code>), <code>-sm</code>. |
| assets/tokens.css (dark) | Danger solid #A11D1D on ink is 2.2:1, so invalid-input edges, the danger sheet ring and the emergency stop’s outline nearly vanish in dark. | New role <code>--color-border-danger</code> (red-700 light, red-300 dark) for those edges; the fill stays #A11D1D for the 7:1 label. |
| assets/ui.css | <code>.sidebar-layout</code> read <code>--layout-sidebar-width</code>, which no token defined. | Removed; Gattsby has no sidebar. |
| assets/ui.css | Switch rules and <code>.inv__feed</code> declared twice. | Merged into one rule each. |
| assets/ui.css | Kit parts no mock uses: tabs, breadcrumb, pagination, stepper, top bar, nav links, sidebar, avatar, accordion, drawer, popover, tooltip, dropdown menu, sortable table, list, badge, select, input group, button group, link and block buttons, stat, well. | Not carried into <code>components.css</code>; see “Not extracted” below. |
| dialogs/approval, confidence meter | The confidence meter uses <code>role="progressbar"</code>. | Documented as <code>role="meter"</code>, which matches a level rather than progress; fix in the product, the mock is unchanged. |
| pages/investigation (stage track) | The current-stage segment in signal is 2.8:1 on paper (mocks README, open question 3). | Kept as redundant: the stage is named in the subtitle and the segment is taller. Listed in <code>contrast-pairs.json</code> with min 1 and the reason. |

## Not extracted

The extraction skill lists a core set every product is expected to have. These parts of it are left out
because no Gattsby screen uses them and AGENTS.md asks that nothing be built that does not help identify a
device. Add one only when a mock needs it.

| Component | Why not |
|---|---|
| Sidebar navigation, tabs, breadcrumb, pagination | Gattsby is shallow; every screen is reached from Home and the app bar. No mock uses them. |
| Select, radio group, combobox, date picker, slider | No screen asks for them; choices are quick replies, chips or buttons beside a machine. |
| Tooltip, popover, dropdown menu, drawer | Every overlay is a sheet, which works one-handed and the same at every width. |
| Avatar, accordion, stat with delta, pagination | No mock content needs them. |

## Open questions

The mocks' open questions still apply (see [docs/mocks/README.md](../mocks/README.md#open-questions-and-assumptions)).
Two touch this system directly: whether the signal current-stage segment (2.8:1 on paper, redundant with text)
is acceptable, and whether observation confidence (*confirmed, likely, guess*) and metric status (*confirmed,
claimed only*) should stay two vocabularies.

## Verification

Run on 25 November 2026, after the last change:

| Check | Result |
|---|---|
| `check_contrast.py docs/design-system/tokens/tokens.css` | 160 passed, 0 failed (80 pairs × light and dark). The first run failed 3 dark pairs (danger red edges on ink, 1.8–2.3:1); fixed with `--color-border-danger`. |
| `tokens_to_json.py` | `tokens/tokens.json` written, 270 tokens. |
| `check_design_system.py docs/design-system` | 58 pages (12 foundations, 35 components, 10 patterns, index), 0 errors, 0 warnings. Every token in `tokens.css` (207) is on exactly one foundation page. |
| `check_mocks.py docs/mocks` | 27 screens, 111 mocks, 0 errors, 0 warnings, with the mocks reading the design system’s tokens and components. |
| Design-system pages in Chromium (Playwright) | All 58 pages at 360, 768 and 1280 px in light and dark (348 captures): no horizontal scroll, no console errors, no failed loads. Reviewed by eye: the index, color, button, dialog, activity feed, prompt dock, text field, emergency stop and approvals pattern. Fixed during review: example canvases that widened the page at 360 px, the doc chrome shrinking titles inside examples, a sheet caught mid-animation, and overlapping anatomy callouts. |
| Mocks before and after | Every mock captured at 360 and 1280 px in both themes before (from the last commit) and after pointing the mocks at the system. Differences are the spacing snaps (a few pixels taller; readiness rows +24 px in total) and the red-300 outline on the emergency stop in dark; layouts and content are unchanged. |


## Re-running the checks

```sh
python .claude/skills/extracting-design-systems/scripts/check_contrast.py docs/design-system/tokens/tokens.css
python .claude/skills/extracting-design-systems/scripts/tokens_to_json.py docs/design-system/tokens/tokens.css
python .claude/skills/extracting-design-systems/scripts/check_design_system.py docs/design-system
python .claude/skills/writing-html-mocks/scripts/check_mocks.py docs/mocks
python .claude/skills/writing-html-mocks/scripts/screenshot_mocks.py docs/design-system --out docs/design-system/.cache/shots
```
