# Privacy and permissions

## Consent to observe

ExitLens uses a two-part gate. The user grants Chrome host access and enables recording for an exact origin in **Site access**. Chrome's host pattern is scoped to the scheme and hostname. The worker separately checks scheme, hostname and port before it accepts an observation from a top-level page. On the fictional demo, the optional second host grant allows Chrome to report the simulated request to `localhost`. [Chrome host permissions and match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns).

| Manifest permission | Use |
| --- | --- |
| `storage` | Store commitments locally and hold active journey state for the browser session |
| `sidePanel` | Show the ledger and guide beside the website |
| `scripting` | Register and attach the observer on enabled sites |
| `activeTab` | Read the current tab when the user opens the extension to suggest its origin |
| `cookies` | Compare a narrow set of consent and analytics cookie names |
| Optional `webRequest` | Requested on site opt-in to observe permitted request initiators, hostnames and timing in the consent audit |
| Optional HTTP/HTTPS host grants | Let the user choose which sites to enable |

## What is stored

- A canonical action, timestamp, category, origin, protected page path and the resulting status.
- Matched price, renewal, trial or cancellation phrases and related visible status evidence. Unknown terms stay unknown.
- A bounded graph with recognised control labels, allowed links, edge evidence and generic accessibility findings.
- Selected cookie names and permitted destination hostnames with timestamps after a consent choice.

The observer avoids form field contents, passwords, payment details, authentication tokens and free-form webpage excerpts. Stored page URLs follow a restrictive path vocabulary. URLs with query strings, fragments, credentials or unknown path segments are redacted to the origin and a private-path marker. Cookie checks query exact names and keep names only. Request observations carry hostnames and classifications. ExitLens keeps no request payloads, headers or complete request URLs in the ledger.

All evidence stays in Chrome local storage on the device. In-progress tab context stays in Chrome session storage across worker restarts within that browser session. The current build uses no remote provider or extension telemetry.

## Consent audit coverage

Chrome reports eligible subresource events when both the initiating and destination hosts are permitted. ExitLens checks that the request comes from the enabled origin in the tab, belongs to a different site and occurs within 30 seconds of a recorded consent choice. The report's cookie comparison is limited to the names listed in the worker. An absent request or cookie in the report can reflect permissions, timing or limited classifier coverage. [Chrome WebRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest).

The classifier is a small project-maintained indicator list:

| Host or fixture | Reason for classification |
| --- | --- |
| `doubleclick.net` and its subdomains | Google advertising and Floodlight endpoints. [Google tag verification](https://developers.google.com/tag-platform/gtagjs). |
| `google-analytics.com` and its subdomains | Google Analytics measurement endpoints. [Google tag verification](https://developers.google.com/tag-platform/gtagjs). |
| `connect.facebook.net` and its subdomains | A Meta resource host used by implementations that load Meta Pixel. Host-level matching can include other Meta script activity. [Meta Pixel event documentation](https://developers.facebook.com/docs/facebook-business-extension/fbe/guides/pixel-events). |
| `http://localhost:4173/signals/ad.gif` from `http://127.0.0.1:4173` | Explicit local test fixture. Events carry a **Simulated advertising** label. |

A classified request after rejection or withdrawal is a **potential consent inconsistency**. The request and cookie observations alone cannot establish its purpose, whether sensitive information was transmitted, or whether processing violated a legal requirement.

## Controls

- **Remove access** stops recording on an origin. Existing records remain available to the user.
- **Clear memory → Erase all records** removes all commitment records and in-progress tab state. Approved origins remain enabled until separately removed.
- **Mark as resolved** records the user's decision without asserting browser-observed verification.
