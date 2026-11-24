# MVP and 24-hour hackathon roadmap

## Current release

The unpacked extension, fictional streaming site and local server ship together. The extension includes site opt-in, a durable commitment history, search and filters, evidence views, visible-control graph discovery, guided cancellation, a human-checkpoint pause, and evidence-backed outcomes.

The release also includes a narrow consent audit, subscription terms and timeline, selected accessibility checks, a reversibility report and on-device speech where available. It uses deterministic rules and local storage. Run the [demo walkthrough](demo-guide.md) to exercise the workflow in a Chrome profile.

## 24-hour expansion

| Time box | Work | Completion check |
| --- | --- | --- |
| 0–5 hours | Run the full Chrome acceptance matrix, harden observer timing and test same-page transitions, multi-tab contention and extension restarts. Add realistic fixtures for competing plan terms and cancellation choices. | The demo passes twice in a clean profile. Negative fixtures stay pending or suspected. |
| 5–10 hours | Add safer locale-aware extraction, stronger subscription-to-account matching and richer graph state for same-page dialogs. Add one more fictional subscription and a second consent workflow. | Detection explains missing fields and binds verification to the correct commitment in fixture tests. |
| 10–15 hours | Test keyboard-only and screen-reader journeys, improve alternate-path ranking and add an export with provenance and user-selected redactions. Prototype renewal reminders as an opt-in. | The core path is usable by keyboard. Export distinguishes discovered, observed and inferred information. |
| 15–20 hours | Add an opt-in Bedrock proxy for ranking and term extraction. If time permits, add ElevenLabs speech through the same consent and credential boundary. | Disabled mode remains fully functional. Invalid or unavailable provider responses fall back to local behaviour. |
| 20–24 hours | Repeat the native browser acceptance run, validate public nontransactional controls on more sites, prepare screenshots and record the reproducible demonstration. | A new reviewer can install and complete Remember, Reverse and Verify from a clean profile using the README. |

The MVP's constraints remain priorities for expansion. Users control consequential actions, webpage content remains untrusted, and verified status requires observable evidence.
