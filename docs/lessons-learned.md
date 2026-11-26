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

## Journey 3, slice 3: Read FTMS features and ranges

- The existing Identify rules already read the FTMS feature and speed range individually. The new
  acceptance test checks both the structured probe in the feed and the number of raw reads, so
  adding the dedicated tool cannot accidentally read the same characteristics twice.
- Read the ranges during Identify, before asking the person to move. The answers survive even if
  they skip live confirmation.

## Journey 3, slice 4: Issue the Connected verdict

- The new critical path failed first with "Partially decoded". The verdict builder already
  accepted a `metric-confirmed` observation, so the confirmation step now publishes that kind
  with raw evidence for both Speed and Distance when the readings support it.
- Check the counter against its last baseline reading while the belt moves. The unchanged-speed
  case still records the person’s answer without treating it as evidence that speed was confirmed.

## Journey 3, slice 5: Confirm the FTMS bike

- The bike acceptance test failed first at Identify’s exit to Conclude. The bike uses the same
  subscription and speed threshold as the treadmill but has its own data layout and prompts.
- Cadence has half-RPM precision, while power is an integer in watts. Checking both values with the
  simulator proves that the optional cadence field does not throw off the power offset.

## Journey 3, slice 6: Confirm a heart-rate strap

- The phone-width acceptance test failed first because Identify did not enter the Standard path.
  It now checks a 95 to 120 BPM change, the 48 px live reading, and the Connected verdict.
- Use one confirmation window for the treadmill, bike and strap. The device-specific metric and
  minimum rise determine what counts, and the tool records only a change it saw in a notification.

## Journey 3, slice 7: Persist decoded notifications

- The acceptance test found the baseline’s raw notifications but no decoded fields. A raw log
  entry now carries its decoding or error before it is handed to the existing batch flush.
- Keep the epoch timestamp and evidence ID assigned by the raw log. Confirmation uses that same
  timestamp, so a result and its evidence describe the same packet.

## Journey 3, slice 8: Ask whether the person is still there

- The fake clock exposes a missing two-minute transition without slowing the test. The two waits in
  the new spec cover both reopening the original prompt and stopping without starting a recording.
- Keep the original prompt pending while the modal is open. Closing it can return focus to the
  original control, and continuing can restart the timer without duplicating a prompt or an answer.

## Journey 3, slice 9: Save timed recordings

- Decoded rows alone did not tell a later tool which packets belonged to the baseline. The
  acceptance test now reads the persisted recording and checks that the linked raw rows match its
  value count.
- Save the recording with the same transaction as the tool step. Keep packet counts and distinct
  lengths in memory while listening, and batch the packet writes through the existing raw log.

## Journey 3, slice 10: Analyse the saved baseline

- The critical path already asserted the verdict. Extending it to inspect the saved
  `decode_standard` result caught a missing link between confirmation and the timed baseline.
- Use the recording’s step index to fetch only its packets. Keep the statistics and errors in the
  playbook step. Per-packet values are available from the raw rows when a person needs the evidence.

## Journey 3, slice 11: Keep the rules for readable metrics

- The critical path could show a confirmed metric before it had enough saved information to
  explain how to decode it. It now checks a fixed byte offset, a flag rule, and the difference
  between a field seen without confirmation and a device claim that never appeared.
- Reuse the decoder’s layout for claims without live samples. The saved rule then agrees with the
  code even when no packet carried the field during this investigation.

## Journey 3, slice 12: Verify the recording rate

- Run the actual BLE adapter and notification recorder with four independent 50 Hz streams and
  a fake clock. A packet on the deadline was excluded until the recorder compared its timestamp
  with the inclusive cutoff.
- A later recording of the same characteristic used to leave both listeners attached. Replace
  the prior listener before starting the next one so each packet is logged once.

## Journey 3, slice 13: Compare the live and not-confirmed states

- A follow-up question alone left the missed check implicit. The dock now states what was not
  confirmed and explains that the person's answer will be saved with the samples.
- Read the notification rate from the actual packet times. The panel and confirmation badges
  update with the frame that shows the reading.
- Chromium loaded the Identify, live readings, not-confirmed and Verdict mocks at 360, 768, 992
  and 1280 px in both themes. The phone and laptop comparisons are in
  `docs/assets/journey-03/`. The Verdict mock also illustrates features from later journeys,
  including Evidence and Export.

## Journey 3, slice 14: Check memory through a long investigation

- Keep the device subscribed for 30 virtual minutes at 20 Hz. The fake clock preserves every
  notification and the normal IndexedDB writes. The Chromium heap test runs on demand because
  it takes several minutes even with virtual time.
- Verify the number of stored packets as well as the collected heap. A quiet characteristic could
  otherwise pass a memory check without exercising continuous traffic.

## Journey 3, slice 15: Keep evidence for each confirmed reading

- An incline check needs the most recent incline before the prompt. Offer the check when a small
  rise to the mock's target can be measured, and preserve the earlier speed and distance evidence
  when the person skips it or the incline does not change.
- A single pace change can supply separate evidence for distance, elapsed time, bike cadence and
  bike power. Each confirmed field links to its own before and after packets. Other claimed
  readings retain their decoding rules and the status supported by the investigation.

## Journey 4, slice 1 — Save the profile with the verdict

- The finished treadmill test first found an empty profiles store. The verdict transaction now
  saves the profile and the investigation’s link together.
- Resolve packet evidence by IndexedDB key. This applies journey 3’s bounded-memory lesson
  when an investigation outlasts the live packet window.
- Compile schema validators before bundling so the production Content Security Policy can
  remain in force while profiles are checked.

## Journey 4, slices 2–6 — Open, export and label the result

- The Device profile route and both export triggers were absent in the first acceptance runs.
  The same Export dialog now handles both entry points and waits for a person's choice.
- Building the record exposed a missing evidence field in the schema. Validate the serialized
  JSON in the browser and check the downloaded file independently in Playwright.
- Export uses the bounded batches established in journey 3. It checks each page of up to 2,000
  raw packets and stores serialized pages as Blob parts.
- Location goes through the same IndexedDB transaction boundary as the verdict link. This
  preserves the person's edit if the investigation concludes while the Add note dialog is open.
- Simulating a quota refusal showed that the finish step must stay available after the
  investigation route closes. The Verdict page can export that commit from memory or retry it.
- The phone comparison exposed a crowded action bar and checkbox. Moving the profile link to
  the app bar and reusing the design system's choice control resolved both.

## Journey 5 — Check readiness

- The fresh-tab test first stayed on Home. Readiness now opens first and checks each capability
  before offering to continue. Subsequent Home visits in the tab retain the person's choice.
- The simulated Bluetooth API exposes advertisement scanning only when the spec asks for it.
  Merely defining a stub method made the old detection report the capability incorrectly.
- Start the Chrome download from the button handler and destroy the temporary session when it
  finishes. The controller keeps reporting progress if the person continues to Home.
- A simulated stall now lets the real storage probe settle before advancing the fake clock.
  This applies journey 3's separation of timed events from IndexedDB completion.
- Readiness keeps up to 50 probe failure diagnostics in local storage. It returns the same
  diagnostics with the Prepare result so they can appear in the investigation record.

## Journey 6 — Investigate with the agent

- A test for ambiguous identification needs two different plausible protocols. Two profiles
  within the score margin that both describe FTMS still give the playbook one protocol choice.
- The session check can succeed at availability and fail at creation. Open the session
  before Prepare to make the first displayed mode match the session the investigation holds.
- Compile model-action and tool-input schemas before bundling, as in journey 4. The same
  production Content Security Policy test then exercises validated actions without runtime compilation.
- A readable characteristic also needs to appear in the investigation's GATT layout. Refuse
  a proposed read at validation so it never reaches the Bluetooth adapter.
- Separate leaving the page from concluding the investigation. Aborting the pending
  consultation on exit now releases the session and leaves the stored verdict unset.
- Use the fake clock for model timeouts, as in journey 5, and wait for a stored step before
  reading its evidence. Repeated missing-tool reports keep one request and reuse its ID.

## Journey 7 — Investigate by checklist

- The first no-model test checked API calls. Checking the scripts actually loaded then found that
  Readiness had downloaded the adapter to discover the API was absent. A lightweight presence
  check keeps both model modules out of that path.
- Choosing Match known profiles before Device Information is valid. Reading new device
  information refreshes the profile candidates before they are used.
- Apply journey 6's per-step mode record at fallback. Commit the triggering step and mode change
  together, and keep feed entries attributed to the mode in which they ran.
- Keep the explicit Ready response as the trigger for a timed recording. Asking for another
  checklist choice after Ready would let the device's activity change before recording starts.

## Journey 8 — Test one control command

- The guard rejected the first write after a simulated device withdrew permission. Bind every
  approval to the connection as well as the exact characteristic and bytes, and check the
  current grant and live reading immediately before writing.
- The live-metrics and export specs now explicitly skip the optional Control stage. They still
  check the same read evidence and confirm that skipping sends nothing.
- Enable Control Point indications before writing. This captures a response arriving before
  the write promise resolves. The initiating approval and packet evidence are stored together.
- An unexpected effect now blocks future test commands and puts Emergency stop beside the
  physical-stop instruction. The earlier mock implied that Stop had already been sent.
- The emergency action locks itself before attempting Stop. Its one-tap approval covers only
  the known stop sequence. The simulator checks both the acknowledged path and the timeout.
- The command results are committed to the feed and the verdict. The approval dialog currently
  closes after the result, so separate confirmed and failed dialog states remain outstanding.

## Journey 9 — Pick the right device

- A cancelled Chrome chooser gives Gattsby neither its list nor any new device permissions.
  Attribute optional candidate names to the person. Keep the actual selection in Chrome.
- A gap alone can be a slow device or a missed advertisement. Require a regular baseline,
  a return near Done and exactly one eligible candidate. Ask the person to use the chooser
  when the samples do not identify one device.
- Apply the fake-clock lesson from journey 6 to the baseline, power-off window and return.
  Built tests cover both advertisement APIs and verify that each watch ends before connecting.

## Journey 10 — Recover a dropped connection

- Save the partial recording and raw disconnect together. Mark the step interrupted before
  recovery so the repeated step gets a new recording ID and only its new baseline is analysed.
- Reconnect through the original browser permission. Re-resolve GATT handles and rebind data
  subscriptions after the drop. The previous Control Point session and approvals are invalidated.
- Apply the fake-clock lesson from journeys 6 and 9 to reconnect delays. Check the same device
  is retried, notifications return, and the Stop choice produces one verdict after a failed retry.

## Journey 11 — Pause, stop and resume

- A Leave confirmation now guards navigation from the connected Investigation page. Save the
  pending stage for the Home card because the last committed step can belong to an earlier stage.
- A paused recording is discarded while a connection drop retains its partial packets as evidence.
  Both resume from committed steps. Read the highest raw sequence on reopening so new traffic
  cannot overwrite saved evidence.
- Apply the device identity lesson from journey 9. The fallback chooser requires a person’s tap
  and the exact saved browser device ID. Restoring a standard baseline reconnects the live
  subscription without saving a duplicate recording.
- Fake-clock specs cover manual pause, the two-minute Still there pause and the hidden-page
  deadline. Returning before the deadline clears the timer.

## Journey 12 — Report a non-connectable device

- Apply the chooser lesson from journey 9. Chrome reports cancellation and grants no access to
  the list. Record the chooser event and the person's answers rather than claiming an empty list.
- A Bluetooth permission or adapter refusal does not support a transport diagnosis. Require the
  reachability assessment for the verdict and keep the transport uncertain if a check was unanswered.
- Verify both outcomes of the third scan. When the person finds the device, the existing Identify
  path still runs. When they cannot, the verdict links all three scan events and the checks.
