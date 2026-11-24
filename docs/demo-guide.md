# Four-minute demonstration

## Prepare the recording

From the repository root:

```bash
npm ci
npm run build
npm run demo
```

Load `extension/dist` through **Developer mode → Load unpacked** on `chrome://extensions`. Pin ExitLens. Use a dedicated Chrome profile for a clean ledger and keep the local server running. Open [Stillframe](http://127.0.0.1:4173) on a wide window so the website and side panel fit together.

If you rehearsed using this profile, open Stillframe's **Demo controls → Reset demo → Reset fictional account**. In the extension, clear old rehearsal records through **Site access → Clear memory → Erase all records**. For the on-camera opt-in, use **Remove access** for the fictional origin. Keep the demo's simulated request setting enabled. This reset affects the fictional account and ExitLens history in the chosen profile.

## Recording script

| Time | Show on screen | Suggested narration |
| --- | --- | --- |
| 0:00–0:26 | Stillframe home beside the empty ExitLens ledger | “Browsers remember where we went. They rarely remember what we agreed to, what it will cost, or whether we managed to undo it. ExitLens keeps that history on this device and shows the evidence behind each reversal.” |
| 0:26–0:52 | **Site access**. Enter `http://127.0.0.1:4173`, keep the simulated tracker enabled, click **Enable recording** and approve the Chrome prompt | “I choose which sites ExitLens can observe. Stillframe is a fictional streaming service, and the tracker here is a separate local test fixture.” |
| 0:52–1:18 | **Reject cookies**. Wait for the request, then open the consent record's **View Evidence** | “The browser observed my rejection, the selected cookie names, and the simulated request. It flags a potential inconsistency. The network observation on its own cannot tell us whether processing was lawful.” |
| 1:18–1:55 | **View trial offer → Start free trial**. Open the trial's **View Evidence** and show its source excerpts and timeline | “Stillframe offers seven days free, then ₹799 a month. ExitLens saves the words it recognised, the signup time and the published deadline. The welcome screen provides the evidence for the active status.” |
| 1:55–2:37 | **Find Undo Path → Start or resume guide**. Click **Account settings → Manage subscription → Cancel plan → Continue cancellation** | “The graph starts with controls the extension can see. As I follow the highlighted links, it records the transitions and discovers the next screen. Dashed edges are discoveries. Solid edges are observed transitions.” |
| 2:37–3:05 | Show the pause at **Human verification**. Choose **Use accessible verification**, then **Complete human verification** in the new panel | “The guide pauses here and points out the visible alternative. I complete this fictional checkpoint myself, then the next step becomes available.” |
| 3:05–3:35 | **Continue to confirmation → Confirm cancellation**. Show the receipt, then the ExitLens status | “I make the final decision on the site. ExitLens links the fresh cancellation confirmation to this attempt and marks the commitment verified by observable evidence.” |
| 3:35–4:05 | Open **Reversed → View report**. Show the two journeys, result, barriers and ratio if present | “The report brings the evidence together. When the full journeys were observed, the ratio tells us how many reversal actions there were per entry action. The checkpoint and verification outcome are also recorded.” |
| 4:05–4:20 | Reopen Chrome in the same profile and show **Reversed** | “The history persists when I close and reopen the browser. That is the record I can return to when I need it.” |

You can cut between the browser close and reopen. Leave the local server running so the demo remains available.

## Capture screenshots

- **Dashboard**. Capture the full dashboard after the active trial and consent choice appear in the ledger.
- **Graph**. Capture the full dashboard's **Undo path** tab after the reversal so the graph includes the observed edges. Fit the graph and inspect a connection to show its evidence.
- **Accessibility**. Capture the actual pause on the fictional checkpoint with Stillframe and the side panel visible.
- **Receipt and report**. Capture the website receipt and the **Report** tab in ExitLens. Include the evidence and outcome.

For automated screenshots, start the built demo in a separate terminal and run:

```bash
npx playwright install chromium
EXITLENS_SCREENSHOTS=./screenshots npm run test:e2e
```

The runner writes `dashboard.png`, `reversal-graph.png`, `report.png` and `side-panel.png` as it reaches those steps. Its test profile uses only the fictional loopback hosts.

## If a demo step is missing

| What you see | What to check |
| --- | --- |
| Empty ledger after signup | Verify that recording is enabled for the IP address and the permission prompt was accepted. Reset the fictional account and restart at **View trial offer** after enabling it. |
| No simulated request | Confirm the tracker checkbox in **Site access** and the scenario in Stillframe's **Demo controls**. Use the production demo server on port 4173, then reject cookies in a fresh rehearsal state. |
| Guide cannot attach | Keep the authorised Stillframe tab open and start the guide from that trial's record. |
| Ratio is unavailable | Begin with **View trial offer**, continue in the same tab and follow the recorded guide through the verified receipt. A gap in journey coverage leaves the ratio unavailable. |
