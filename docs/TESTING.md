# Knot release test matrix

The repeatable release gate is `npm run test:ship`. Real subscription-backed AI and real Daytona lifecycle tests are intentionally opt-in, and a freshly generated macOS app can be checked with `npm run test:packaged:mac`.

| Persona / boundary | Release behavior exercised |
|---|---|
| Newcomer | Every navigation destination, global search, graph keyboard selection, zoom, and concept opening |
| Knowledge author | Private-by-default creation plus recipient and update-mode selection at creation time |
| Editor | Body/metadata save, custom frontmatter preservation, reserved file handling, and restart persistence |
| Quality steward | External invalid file detection, blocked conformance, repair, and revalidation |
| Publisher | Visible composer controls, concept selection, audience, dependency/download settings, ZIP export, and ledger |
| Privacy auditor | ZIP entry allowlist, transitive dependency closure, manifest fields, policy revocation, and source isolation |
| Collaborators | Author export → editor revision → reviewer notification across separate app sessions |
| Update owner | Read/unread state, review/auto-prepare mode, keep-private acknowledgement, later edits, and update export |
| Cloud owner | Exact document scope, named/public modes, per-recipient capabilities, MCP bearer separation, auto-stop, start/stop, sync, revocation, and source isolation |
| Durable publisher | Stable synced-folder root, immutable revision history, latest-release pointer, provider manifest, update republish, and sharing-ledger baseline |
| Self-host operator | Scoped Docker Compose export, hardened container settings, generated portal/MCP capabilities, proposal persistence, and secret separation |
| Named recipient | Capability URL creation and revocation without receiving the owner’s Daytona key |
| External MCP agent | Local stdio and remote Streamable HTTP initialization, resources, structured tool results, graph traversal, and proposal submission |
| Conflicting editor | Agent proposal base revision followed by a local edit; approval is blocked and local knowledge remains intact |
| Ingestion reviewer | Deterministic extraction, AI-safe fallback, Markdown preview, rejection, approval, atomic publication, collision avoidance, and source preservation |
| Power user | Theme and compact-navigation persistence plus keyboard shortcuts and dialog focus |
| Scale user | 180 generated concepts, library filtering, and a bounded 32-node graph viewport |
| Web researcher | Parallel monitor creation, polling, cited update review, deterministic/AI choice, dismissal, cancellation, and approval-only OKF write |
| Accessibility | Automated WCAG 2 A/AA scanning in light, dark, and system themes on all eleven major surfaces, plus named controls and keyboard paths |
| Responsive desktop | Real mouse-wheel and End-key scrolling on every long product surface at 1120×720, plus horizontal-overflow checks |
| Security | Renderer sandbox isolation, path traversal rejection, duplicate protection, safe Markdown, URL protocol allowlist, encrypted-secret separation, capability hashing, bearer rejection, and Origin defense |
| AI user | Real signed-in Codex app-server request with a selected OKF document and a read-only/network-disabled turn |
| Packaged app | ASAR resource loading, preload bridge, workspace restore, validation, and deterministic export from the `.app` |

Playwright retains traces and screenshots on failure under `test-results/`. The HTML report is generated at `test-results/playwright-report/`.

## Release commands

```bash
npm run typecheck
npm test                 # 14 focused OKF/Markdown/workflow tests
npm run test:mcp         # local stdio and hosted HTTP protocol probes
npm run test:e2e         # 29 scenarios: 25 local passes, 4 live/platform gates skipped
npm run test:live-ai     # signed-in Codex app-server
KNOT_LIVE_DAYTONA=1 KNOT_TEST_CLOUD=0 KNOT_TEST_DAYTONA_API_KEY=… \
  npx playwright test tests/e2e/live-daytona.spec.ts --workers=1
KNOT_LIVE_PARALLEL=1 KNOT_TEST_PARALLEL=0 KNOT_TEST_PARALLEL_API_KEY=… \
  npx playwright test tests/e2e/live-parallel.spec.ts --workers=1
npm run dist
npm run test:packaged:mac
npm run test:packaged:linux  # run under xvfb on native Linux
```

The live Daytona spec always calls `cloud.disconnect()` in a `finally` block. The live Parallel spec always cancels its monitor in `finally`. The Windows release run defaults to one labeled `windows-small` sandbox, distinguishes temporary runner scarcity from permanent tier errors, captures terminal/Playwright/native UI evidence, builds NSIS/portable/ZIP artifacts, downloads evidence, deletes the sandbox, and finishes with a read-only sandbox inventory. `.github/workflows/release.yml` repeats the deterministic gate and packaged-app smoke tests on native Linux, Windows, and macOS runners.
