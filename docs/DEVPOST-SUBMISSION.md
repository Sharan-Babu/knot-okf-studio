# Knot — OpenAI Build Week submission copy

## Project

**Name:** Knot

**Tagline:** A local-first desktop studio that keeps portable OKF knowledge current, selectively shared, and safely usable by people and AI agents.

**Category:** Work & Productivity

**Submitter type:** Team of Individuals

**Country:** United States

**Video:** https://youtu.be/t7z8PrAo_O8

**Repository:** https://github.com/Sharan-Babu/knot-okf-studio

**Devpost:** https://devpost.com/software/knot-vygbao

**Submission ID:** `1109198`

**Feedback Session ID:** `019f6e8c-24b6-75b3-a072-4fd82c209a12`

## Description

### Why we built Knot

Knowledge rarely stays in one place or one version. A product team may have research, decisions, metrics, and playbooks that need to move between people and AI agents. The moment that information is copied into another tool, the team starts losing track of what was shared, who received it, and whether it is still current.

Google's Open Knowledge Format gives that knowledge an open foundation: ordinary Markdown, YAML metadata, and links between concepts. The files stay readable, versionable, and model-independent. We liked that foundation, but a folder alone cannot answer the operational questions around it. Which concepts are private? What did Maya receive last week? Has that content changed? Can an agent search a subset without being allowed to silently rewrite the source?

Knot is the control layer we wanted around OKF.

### What it does

Knot is a local-first Electron desktop app that opens a real OKF folder directly. There is no proprietary import database. It validates the workspace, makes the content searchable, and turns links between concepts into an explorable graph.

Privacy begins while a concept is being created. An author can keep it private, make it available to the workspace, select people or groups, or mark it public. Those policies live outside the portable Markdown so the OKF bundle remains clean.

When selected knowledge is shared, Knot records the delivered revision. If the source changes later, the recipient update queue shows exactly who may now be out of date. The author can review the difference, publish a new version, or explicitly keep the update private. Knot never re-shares a revision silently. The sharing ledger records publication and revocation decisions.

The same selected scope can leave the laptop in several ways. Knot can export a portable OKF ZIP, publish immutable releases into a Drive/Dropbox/Box-synced folder, generate a hardened self-host deployment, or create an on-demand Daytona portal. Named Daytona links are independent revocable bearer capabilities; they are not identity federation. MCP agents receive separate credentials, and a stopped Daytona sandbox must be started by its owner rather than pretending that opening a link wakes it.

### A complete knowledge workflow

Knot also helps knowledge stay current. Web Watch uses Parallel to follow a narrowly defined public topic and retain cited updates. A user can dismiss a result, prepare it through a deterministic workflow, or ask Codex to draft a proposal. Imported documents follow the same pattern. Nothing writes into OKF until the user inspects and approves the proposal.

The knowledge base can be exposed to external AI clients through the Model Context Protocol. Agents can search, open concepts, inspect types, and follow graph connections within the scope they were given. An agent that wants to change knowledge submits a proposal with a base revision. Human approval and revision checks prevent it from overwriting a newer local edit.

Knot Assist uses the user's existing ChatGPT/Codex sign-in through the local Codex app-server. Each turn is ephemeral, read-only, network-disabled, and limited to the concepts the user selected. It does not require us to proxy prompts through a Knot-owned cloud service.

### How we used Codex and GPT-5.6

Codex was part of the build from research through release. We used it to read the OKF and MCP specifications, model the privacy and synchronization boundaries, implement the Electron/React application and hosted services, and turn product questions into automated tests.

GPT-5.6 was particularly valuable when the right answer was not simply more code. It helped challenge our assumptions about Daytona availability and link security, distinguish bearer capabilities from identity, design proposal-only agent writes, and reason through stale-revision conflicts. We then encoded those decisions in the UI, documentation, and Playwright tests.

Our deterministic release suite simulates newcomers, authors, editors, reviewers, privacy auditors, publishers, external MCP agents, conflicting editors, ingestion reviewers, and power users. It checks the generated bundles and deployments, exercises both MCP transports, scans the major surfaces for serious accessibility violations, and verifies layout behavior at constrained desktop sizes. Live provider paths are opt-in and always clean up their temporary resources.

### What we are proud of

The most important result is not a single AI feature. It is a coherent system of control. The knowledge remains open and belongs to the user. People decide what leaves the workspace. Recipients do not quietly drift onto stale versions. Agents can use the same connected knowledge without receiving unreviewed write authority.

Knot is an independent implementation and is not affiliated with Google Cloud or OpenAI.

## Built with

- Electron
- React
- TypeScript
- Open Knowledge Format (OKF)
- Model Context Protocol (MCP)
- Codex app-server
- GPT-5.6
- Playwright
- Vitest
- Daytona
- Parallel
- Radix UI
- FFmpeg
- HyperFrames

## Judge testing instructions

Requirements: Node.js 22+ and npm 10+.

```bash
npm install
npm run dev
```

The Atlas sample workspace opens automatically. No provider API key is required for the core walkthrough. The optional guided tour introduces the major product surfaces.

Suggested path:

1. Explore the OKF workspace and graph.
2. Create a concept and choose its privacy/audience policy.
3. Open Sharing and inspect the stale-recipient notification and ledger.
4. Review Web Watch and the approval-gated workflow proposal.
5. Open Cloud & MCP to compare portable, synced-folder, self-hosted, and Daytona publication.
6. Open Knot Assist to inspect its selected-context, read-only safety model.

Deterministic release validation:

```bash
npm run test:ship
```

Optional live Daytona, Parallel, and Knot Assist features require the judge's own provider credentials or signed-in Codex subscription. Do not use the live provider paths for the core evaluation.

Supported source platforms: macOS, Windows, and Linux. The provided macOS artifacts are unsigned and intended for evaluation; source execution is the recommended cross-platform path. Windows packaging has been cross-built and integrity-checked, but native Windows execution is not claimed because the requested external runner capacity was unavailable.
