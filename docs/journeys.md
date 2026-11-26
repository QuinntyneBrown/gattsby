# Journeys

In order of value. Effort is days for one intermediate developer, tests included. Journey 2 carries
the shared core (BLE layer, knowledge base, store).

| # | Journey | Description | Effort (days) | % complete |
|---|---|---|---|---|
| 1 | Scaffold the app | Angular workspace, app shell, CI, lint and Playwright with device fakes. | 5 | 100 |
| 2 | Identify a standard machine | Scan, connect and name an FTMS or heart-rate device's protocol. | 10 | 85 |
| 3 | Confirm live metrics | Decode live data and confirm it with a walk or pedal. | 6 | 100 |
| 4 | Export the device profile | Save the verdict and profile as versioned JSON. | 3 | 100 |
| 5 | Check readiness | Show missing browser capabilities, what they limit and how to fix. | 3 | 100 |
| 6 | Investigate with the agent | Gemini Nano chooses a validated action when the playbook is ambiguous. | 12 | 100 |
| 7 | Investigate by checklist | Follow the standard and proprietary paths step by step without a model. | 4 | 100 |
| 8 | Test one control command | Approve one low-risk FTMS command, confirm its effect and use emergency stop while connected. | 8 | 95 |
| 9 | Pick the right device | Match the device in Chrome or use advertisements from already permitted devices. | 3 | 100 |
| 10 | Recover a dropped connection | Detect a drop, reconnect to the same device and repeat the interrupted recording. | 3 | 100 |
| 11 | Pause, stop and resume | Confirm stop or leave, pause automatically or on request, and resume with the same device. Opening stopped records from history is journey 15. | 3 | 95 |
| 12 | Report a non-connectable device | Check power, other connections and range, then explain what Chrome could establish after three scans. | 2 | 100 |
| 13 | Decode a proprietary protocol | Compare saved activity levels, report candidate encodings and framing, and stop recording at quota. The link to free space depends on journey 15. | 12 | 97 |
| 14 | Review evidence and missing tools | See the hypothesis, its evidence and capabilities the agent lacked. | 4 | 0 |
| 15 | Browse and delete history | List past investigations and delete one or all. | 3 | 0 |
| 16 | Import profiles and records | Load an exported profile or record back into the app. | 3 | 0 |
| 17 | Work offline | Run fully offline once loaded, with no network requests. | 3 | 0 |
| 18 | Unlock vendor data safely | Send a known vendor unlock, never bypassing encryption or pairing. | 4 | 0 |
| 19 | Read a model plate photo | Photograph the model plate to identify maker and model. | 5 | 0 |
| 20 | Use the agent on a phone | Run full agent mode once phones offer an on-device model. | 5 | 0 |
| | **Total** | | **101** | **71** |
