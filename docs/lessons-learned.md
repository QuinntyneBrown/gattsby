# Lessons learned

One entry per journey or slice, newest last. Read it before starting a slice and apply what fits
(AGENTS.md "Lessons learned"); when the slice finishes, add its entry before it merges.

## Journey 1: Scaffold the app (2026-11-25)

### What slowed it

- **The journey prompt was older than the repository.** It said `docs/design-system/` did not
  exist and that the fonts were in `docs/mocks/assets/fonts/`; both had moved on (the design system
  exists and holds the fonts). Checking the tree before acting avoided re-extracting the design
  system.
- **Angular swallows uncaught errors.** `provideBrowserGlobalErrorListeners()` calls
  `preventDefault()` on every `error` and `unhandledrejection` event and logs them with
  `console.error`, so Playwright's `pageerror` never fires in the app. The page-error guard now also
  fails a spec on any console error.
- **`base-uri 'none'` breaks Angular.** The router needs `<base href="/">`; the design's hardening
  value blocked it. The design, the headers file and ADR 0001 now say `base-uri 'self'`.
- **Chrome exempts DevTools-run code from the CSP's eval check.** `new Function` called directly
  inside `page.evaluate` runs even under `script-src 'self'`. A probe that must be refused runs from
  a task the page schedules (a `MessageChannel` message).
- **Critical-CSS inlining adds an inline `onload` handler**, which `script-src 'self'` refuses. It
  is turned off in the production build (ADR 0001).

### New lessons

1. Read the tree before trusting a prompt's description of it; prompts age faster than code.
2. Turn the Content Security Policy on early. Every spec ran under it from slice 5, and it found
   the `base-uri` conflict at once; a policy added late finds many such conflicts together.
3. Prove each guard with a spec that makes it trip and acknowledges the violation, plus one spec
   (`test.fail`) that proves an unacknowledged violation fails the spec at teardown.
4. Write the behaviour spec before touching the build configuration. The theme and font specs of
   slice 2 passed on their first run, because the design-system styles had already been wired into
   `angular.json` while checking that the build could read them; their red step was missed.
5. Read the design system's CSS from `docs/design-system/` in `angular.json` rather than copying
   it; the build bundles the fonts it references, so the app and the mocks cannot drift. The Not
   found page then matched its mock pixel for pixel, apart from the deferred import action.
6. Pin `@playwright/test` to the version whose Chromium the environment already has; a mismatch
   needs a browser download.

### Earlier lessons applied

None; this is the first entry.

## Journey 2: Identify a standard machine (2026-11-25)

### What slowed it

- **Journey 1 was not on `main`.** It sat in an open pull request (#11). The prompt said to report
  that as a blocker. The journey was complete on its branch, so this branch was started from it;
  #11 merged before journey 2 finished, and the branch was rebased onto `main`.
- **The shared core came before its slices.** The store, knowledge base, registry, BLE layer and
  orchestrator were written in one pass behind the first slice's spec. The later slices' specs
  (Find, Connect, Identify, Hypothesis, Conclude) therefore mostly passed on their first run, and
  their red step was missed. Only the reload, viewport and emergency-stop checks were seen to fail
  first.
- **A `computed` that returns before reading a signal never re-runs.** The feed read the knowledge
  base from a plain field and returned early while it was null, so it tracked no signal and stayed
  empty forever. Every input of a `computed` must be a signal.
- **A new route can swallow an old spec's address.** The Not found spec used
  `/investigations/no-such-investigation`; the new investigation route caught it until a
  `canMatch` guard let unknown investigations fall through.
- **Playwright's installed clock gives whole-millisecond `performance.now()`.** A check that
  timestamps carry a fraction failed; FR-073 asks for millisecond resolution, which whole
  milliseconds meet.
- **Node cannot import the app's TypeScript.** Extensionless imports break Node's type stripping,
  so the knowledge-base script reads the decoder IDs from a JSON file.

### New lessons

1. Build the shared core one slice at a time, behind the spec that first needs each part, even
   when the design describes it whole. Otherwise later specs only confirm, never drive.
2. Make every value a `computed` reads a signal, including values loaded once.
3. When a route is added, rerun every spec. An address an older spec used may now match it.
4. Give the fake device a delay knob (`readDelays`) on the page's clock. A step that is "running"
   cannot otherwise be seen by a spec, and the delay costs nothing in other specs.
5. Pick a verdict a journey can honestly issue, and record why. "Connected — FTMS" needs live data,
   which journey 3 adds, so journey 2 issues "Partially decoded" (issue-the-verdict design).
6. Every path to `finish` needs a verdict the evidence supports. Otherwise a refused `finish`
   loops; `finish` now raises the request that blocked it, and a second refusal ends the loop.
7. Check a pinned action bar with `toBeInViewport`, not `toBeVisible`. The Verdict page's bar
   rendered below the fold until the page used `app--fixed` as its mock does.

### Earlier lessons applied

- Journey 1, lesson 1 (read the tree before trusting the prompt): the prompt named "New
  investigation" for the Home button, but the mocks and FR-007 say "Identify a device"; the mocks
  won. Checking the remote branches found journey 1's work.
- Lesson 2 (the CSP from the start): every new spec ran under the CSP and Trusted Types. The
  hostile-name device ran with no violation, and nothing new needed a CSP change.
- Lesson 3 (prove each guard): the no-model guard is checked in the critical spec
  (`fakeModel.prompts()` empty, no `create` call).
- Lesson 4 (write the spec before configuration): broken again for the core, as above.
- Lesson 5 (design-system CSS from `docs/`): the pages use the design system's classes
  unchanged; the side-by-side screenshots differ only where a part is deferred.
- Lesson 6 (pin Playwright): unchanged; no browser download was needed.

## Journey 3, slice 1: Subscribe to Treadmill Data

- The acceptance test failed on the old build because Identify went straight to Conclude. It
  then caught a second problem: the saved action answer defaulted to "Done" after the person
  tapped "Ready". The action result now carries the button the person used.
- The scripted treadmill already produced FTMS notifications from the fixture’s effort setting.
  Advancing the browser clock exercised the real subscription and decoder without adding fixed
  waits or a second fake transport.
- Journey 2’s verdict lesson still applies. Seeing a speed on the live tile does not yet make it
  confirmed. The confirmation slice will supply the evidence the Connected verdict needs.
- On Windows, the global Git configuration checks tracked files out with CRLF. Prettier passed
  with the local end-of-line mode set to auto. The repository still stores LF.

## Journey 3, slice 2: Confirm treadmill speed

- Both new Chromium cases failed first at the missing speed action. The speed increase test changes
  the fake’s effort before "Done", so it catches a window that opens too late. The unchanged-speed
  test advances the clock after "Done" and records the person’s answer without treating it as
  confirmation.
- Keep the baseline and the first qualifying notification separately. Their raw log IDs let the
  investigation explain what changed without consulting the model or holding the action recording
  in memory.
