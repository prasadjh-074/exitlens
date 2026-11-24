# ExitLens

[![CI](https://github.com/prasadjh-074/exitlens/actions/workflows/ci.yml/badge.svg)](https://github.com/prasadjh-074/exitlens/actions/workflows/ci.yml)

**The Web's Missing Undo Button.**

CodeRIT wHACKiest 2026 · Track 2 · Beyond the Browser: Browsing for Everyone

Starting a trial or granting consent can take one click. Weeks later, the terms, account settings and proof of cancellation can be spread across several pages. ExitLens is a local-first Chrome extension that connects those steps into a record you can revisit.

- **Remember** a subscription or consent choice after you enable recording for its website. See the observed action, readable terms and evidence for the status.
- **Reverse** with a guide that highlights a visible control and grows a directed graph as you move through the site's own settings.
- **Verify** the outcome from fresh page evidence. If you close a record yourself, the ledger shows **User marked as resolved**.

## Presentation demo

Use Node.js 22.12 or newer and Chrome 120 or newer.

```bash
git clone https://github.com/prasadjh-074/exitlens.git
cd exitlens
npm ci
npm run build
npm run demo
```

Open the [interactive walkthrough](http://127.0.0.1:4173/). Select **Play walkthrough** for a self-running preview, or use the page controls and arrow keys to tell the story at your pace. **Present** expands the walkthrough for recording. The fictional replay uses the project’s terms parser, path planner and verification rules, with its own in-memory scenario.

## Live extension walkthrough

1. Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose this repository's `extension/dist` directory.
2. Click **ExitLens** from the Chrome extensions menu to open the side panel. Pin it for easier access. The panel's external-link icon opens the full dashboard. You can also open the extension's options from `chrome://extensions`.
3. In **Site access**, enter `http://127.0.0.1:4173` and click **Enable recording**. Leave **Include the simulated tracker at localhost:4173** checked to demonstrate the consent audit. Approve the browser's host request.
4. Click **Open demo** or visit [Stillframe](http://127.0.0.1:4173/stillframe). Use the IP address for the live sandbox. The separate `localhost` address serves the simulated request.
5. Click **Reject cookies**, then **View trial offer** and **Start free trial**. Open the new trial record with **View Evidence**. The fictional plan shows ₹0 up front and ₹799 per month after seven days.
6. Select **Find Undo Path**, then **Start or resume guide** while Stillframe is open. Follow **Account settings → Manage subscription → Cancel plan → Continue cancellation**. At the simulated human checkpoint, choose **Use accessible verification**, then **Complete human verification** in its panel.
7. Click **Continue to confirmation** and **Confirm cancellation**. Check the fictional receipt and open the trial's **Report** in ExitLens. Reopen the same Chrome profile to check that its history persists.

The demo runs on loopback and offers a fictional membership. It collects no payment information and uses a local tracker fixture. See the [four-minute walkthrough, reset steps and screenshot instructions](docs/demo-guide.md).

## Demo result

In the fictional Stillframe walkthrough, ExitLens recorded a seven-day trial, guided cancellation through a retention offer and an accessible human-verification option, and verified the outcome from the receipt. The report counted **2 entry actions and 8 reversal actions (4.00×)**. The ratio describes the observed walkthrough. [Demo script](docs/demo-guide.md).

## What the graph adds

The graph connects the action that created a commitment, the available ways to undo it, and the outcome the browser could observe. Each directed edge carries its action, evidence, confidence, friction estimate, known accessibility obstacles and whether it requires confirmation. React Flow renders discovered controls with dashed edges and observed transitions with solid edges. A visible control can be recorded before its destination is observed.

The guide ranks reachable reversal targets by how directly they relate to the goal. Within each tier, Dijkstra's algorithm selects the lowest-cost path through known edges. The cost starts with one action and adds weight for consequential confirmation and observed barriers. As you navigate, the extension updates the graph and checks what the next screen actually contains. It links a fresh confirmation to a recent reversal action in the same tab before marking the record verified.

When both journeys have enough coverage, the report shows the **Digital Reversibility Ratio**, the count of observed reversal actions divided by observed entry actions. This prototype usability metric describes the captured journey. Accessibility barriers and verification outcomes have separate fields. [Read the architecture](docs/architecture.md).

## Privacy and access

Recording starts with a Chrome host grant and an exact-origin opt-in in ExitLens. The extension uses trusted clicks, visible controls, small extracts of public-facing terms, selected cookie names and permitted third-party hostnames. It keeps records in Chrome's local storage. **Site access → Remove access** stops recording on that origin. **Site access → Clear memory → Erase all records** deletes commitment records, graph history and evidence. [Read the data and permissions details](docs/privacy.md).

## Development and testing

GitHub Actions runs the checks and fictional Chrome walkthrough. Each run publishes an unpacked extension build and includes screenshots when the browser test produces them. [Workflow runs](https://github.com/prasadjh-074/exitlens/actions/workflows/ci.yml).

```bash
npm run lint
npm run typecheck
npm test
npm run build

# With npm run demo running in a separate terminal
npx playwright install chromium
npm run test:e2e
```

Vitest covers detection, ambiguous price extraction, URL redaction, pathfinding, verification, and the service worker with mocked Chrome APIs. The Playwright runner uses a fresh Chrome for Testing profile and a temporary extension copy with access limited to the two loopback hosts. It exercises app-level opt-in, trusted clicks, the consent signal, guided cancellation, the receipt, the side-panel layout and restart persistence.

Lint, strict type checks, 32 Vitest tests and both production builds passed. A signed-out Chrome for Testing profile loaded the production extension, granted the two loopback hosts, recorded the simulated tracker request, and completed the trial and guided cancellation. The native side panel displayed a verified report with eight reversal actions and two entry actions (4.00×). The verified record and cookie audit survived closing and reopening the profile window. The headless Playwright runner still could not start Chrome in the restricted build shell. Public GOV.UK cookie-banner labels were checked against the classifier without changing live settings. [GOV.UK](https://www.gov.uk/)

## Current limits

- English rules recognise a bounded set of control labels, prices and status phrases. Missing or ambiguous terms appear as **Unknown**.
- Discovery uses visible controls on authorised top-level pages and follows same-origin links. Coverage varies with site markup, frames, opaque routes, sign-in requirements and browser permissions.
- A tracker flag describes observed request activity during a short audit window. The extension cannot determine consent compliance or certify billing outcomes.
- The accessibility scan uses selected axe-core rules and visible human-verification cues. The user completes any required checkpoint.
- The dashboard shows renewal dates. Background reminders, exportable evidence and multi-account matching are roadmap items.

## Sponsor technology

The deterministic workflow runs without credentials or a backend. The extension defines typed interfaces for Bedrock-assisted parsing and ranking, and for optional ElevenLabs speech. The current **Read aloud** action uses an available on-device English voice. Written guidance works without speech support. The server-side sponsor adapters are planned. [Review the integration design](backend/optional-provider-integrations/README.md).

## Repository

| Path | Purpose |
| --- | --- |
| `extension/` | MV3 worker, content observer, dashboard, side panel, graph and evidence |
| `demo-site/` | Interactive presentation and Stillframe live sandbox |
| `scripts/serve-demo.mjs` | Production demo server and loopback request fixture |
| `tests/` | Vitest and browser walkthrough runner |
| `docs/` | Architecture, privacy, video walkthrough and roadmap |

The dashboard uses React, TypeScript, Tailwind CSS, React Flow and Vite. The worker and content observer are bundled as Manifest V3 scripts. [See the MVP and 24-hour roadmap](docs/roadmap.md).
