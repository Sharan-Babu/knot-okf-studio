# Knot 1.1 release completion audit

Audited 2026-07-17 against the current source tree, generated services, packaged artifacts, automated test output, live-integration specs, and Daytona provider state. A requirement is marked verified only when the cited evidence exercises the relevant boundary.

| Requirement | Status | Authoritative evidence |
|---|---|---|
| Production Electron OKF desktop application | Verified | `npm run test:ship`; `tests/e2e/core-personas.spec.ts`; packaged macOS smoke; OKF parser/unit tests. |
| Exact private, named, and public sharing scope | Verified | `tests/e2e/sharing-collaboration.spec.ts` and `tests/e2e/cloud-workflows.spec.ts` cover entry-time intent, dependency closure, recipient updates, public/named publication, revocation, and clean Markdown. |
| User-configured Daytona cloud sharing | Verified | `src/main/credential-vault.ts` and `src/main/cloud.ts`; the API key is OS-encrypted, never included in a bundle, and removable. The opt-in live test provisions through product IPC rather than a mock. |
| Daytona lifecycle and bidirectional collaboration | Verified, except native Windows runner | Local-to-remote selected-scope publication, start/stop, revision comparison, remote MCP proposal import, human rejection, and final sandbox deletion are exercised by `tests/e2e/live-daytona.spec.ts`. Remote writes never overwrite OKF directly. |
| Correct sleep/wake semantics | Verified | `scripts/daytona/wake-behavior.mjs` and the recorded live probe show preview traffic keeps a running sandbox active, while fetching a stopped preview returns an error and does not wake it. UI and documentation state owner-start explicitly. |
| Secure OKF MCP for external AI clients | Verified | `tests/mcp-probe.mjs` covers stdio initialization, resources, search, graph traversal, and proposal inbox. `tests/cloud-host-probe.mjs` covers scoped portals, independent bearer authorization, header-only MCP tokens, Origin denial, downloads, and proposal-only writes. |
| Deterministic ingestion | Verified | `tests/workflows.test.ts` and Electron persona tests cover extraction, no pre-approval write, atomic approval, duplicate-safe names, rejection, and stale-revision denial. |
| AI-assisted ingestion with human approval | Verified | The Codex app-server path is ephemeral, read-only, network-disabled, and schema-checked; invalid/unavailable AI output falls back to a deterministic pending proposal. `tests/e2e/live-ai.spec.ts` is the live subscription-backed gate. |
| Parallel web monitoring and reviewed ingestion | Verified | `tests/e2e/web-watch.spec.ts` covers monitor/update review, deterministic and AI preparation boundaries, dismissal, approval, and usage cancellation. `tests/e2e/live-parallel.spec.ts` is the opt-in real lifecycle gate. |
| Durable availability without Daytona compute | Verified | `tests/e2e/cloud-workflows.spec.ts` runs an actual exported synced-folder release and unpacked self-host portal/MCP runtime. Provider ACL and Notion/object-store decisions are documented in `docs/INTEGRATIONS.md`. |
| Exhaustive deterministic release gate | Verified | Current run: 15 unit tests, two service probes, 25 deterministic Playwright scenarios passed, four opt-in/platform scenarios skipped, and zero high-severity production dependency findings. |
| UX, accessibility, and alignment | Verified | All 11 destinations were independently audited at 1120×720 and 1480×940; scale tests found no escaped controls or horizontal overflow; Axe found no serious/critical violations in light, dark, or system themes. |
| macOS package | Verified for internal evaluation | Current DMG and ZIP build, checksum, and packaged smoke pass. Public release still requires Developer ID signing and notarization. |
| Windows x64 package construction | Partially verified | Current ZIP passes archive integrity checks and contains a PE32+ x86-64 GUI executable. Native execution is not inferred from cross-build evidence. |
| Native Windows execution and installer evidence | **Blocked by external capacity** | `artifacts/windows/windows-release-summary.json` records 15 `windows-small` attempts in the US region, all rejected with `No available runners`, despite sufficient unused Windows quota. No sandbox was created. `.github/workflows/release.yml` and `scripts/daytona/windows-release.mjs` contain the ready native ladder. |

## Current deterministic gate

```text
TypeScript: passed
Vitest: 15 passed
MCP probes: 2 passed
Playwright: 25 passed, 4 expected opt-in/platform skips
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
macOS packaged smoke: passed
Windows ZIP integrity and PE architecture: passed
Native Windows runtime: not run — Daytona shared runner unavailable
```

## Daytona capacity conclusion

The last account audit reported an active `windows-small` snapshot and unused US Windows quota of 2 vCPU, 8 GiB memory, and 30 GiB disk. Fifteen bounded creates returned HTTP 400 `No available runners`; rate-limit headers still showed 595 of 600 creates remaining. A quota mutation cannot create a physical runner. Daytona's documented alternatives are restored shared capacity, a provider-provisioned dedicated region, or customer-operated BYOC region services and runner infrastructure. The final read-only inventory contained no Knot-managed sandbox.

The overall release goal must remain incomplete until the Windows package is executed on native Windows, the `KNOT_WINDOWS_EVIDENCE=1` Playwright scenario passes there, the packaged smoke test passes, and the resulting screenshots/logs are downloaded.
