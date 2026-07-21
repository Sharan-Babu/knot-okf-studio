# Knot security model

## Trust boundaries

1. **Renderer → main process:** the renderer is sandboxed, context-isolated, and has no Node.js integration. A narrow preload API sends schema-validated values to main-process handlers.
2. **Local workspace → Knot metadata:** portable OKF Markdown is user-owned. Recipients, cloud state, revisions, activity, and proposals stay in Electron app data or `.knot/`, which the OKF loader ignores.
3. **Knot → credential vault:** Daytona and Parallel API keys and capability-token plaintext are encrypted with Electron `safeStorage`. Knot does not persist them when operating-system encryption is unavailable. Ordinary state stores only SHA-256 capability verifiers.
4. **Knot → Daytona:** a hosted bundle contains only explicitly selected concepts and optionally their internal dependency closure. It never contains the Daytona key or a capability plaintext.
5. **MCP client → knowledge:** read tools operate inside the selected scope. `propose_update` appends an inbox record; it cannot edit or publish Markdown. A human approves locally, and replacement proposals must match their base revision.
6. **Source document → AI:** imported content is delimited as untrusted reference data. Codex app-server turns are ephemeral, read-only, approval-free, and network-disabled. Invalid or unavailable AI output falls back to a deterministic proposal.
7. **Knot → public web monitor:** Parallel receives only a user-authored topic query. Returned event text is untrusted, retained with its citations, and cannot write to OKF without the normal workflow approval boundary.
8. **Knot → synced folder provider:** Knot writes a selected, versioned static release to a user-chosen filesystem location. Google Drive, Dropbox, Box, Syncthing, or another client transports it. That provider's ACL—not a Knot audience label—determines who can retrieve it.
9. **Knot → self-host operator:** the deployment archive intentionally contains the selected knowledge and generated capability plaintext in `ACCESS.md`. The remote bundle stores only capability hashes. The archive and extracted access file are secrets until the operator places the service behind HTTPS and distributes individual capabilities.

## Hosted access controls

- Public human shares have an uncredentialed portal route by explicit user choice.
- Named human shares use independent 256-bit bearer capabilities, one per selected person or group.
- MCP uses an independent bearer capability. Human links and MCP credentials are not interchangeable.
- Every hosted route applies a restrictive CSP, `Referrer-Policy: no-referrer`, framing denial, MIME sniffing denial, request-size limits, and per-IP request throttling.
- Streamable HTTP rejects unauthorized bearers and any `Origin` not explicitly allowlisted. MCP credentials are accepted only in the `Authorization` header—not query strings—so they are not placed in URLs, history, or ordinary proxy logs. Production OAuth is not impersonated; this release uses revocable capability authorization.
- Daytona’s preview credential is an infrastructure ingress credential, not Knot’s durable audience identity. Knot capability authorization is checked again inside the host.

## Filesystem and sync controls

- Relative paths reject empty segments and `..`; writes are resolved against the active workspace and use temporary-file rename.
- Recursive loading skips symlinks, dot-directories, and `node_modules`, and caps Markdown discovery at 20,000 files.
- Workflow sources are allowlisted by extension, capped at 20 files and 25 MB each, and extracted text is capped at 2 million characters.
- Cloud sync compares local, last-published, and remote revisions. It reports `local-newer`, `remote-newer`, and `conflict`; it does not pull-overwrite local Markdown.
- New workflow concepts use collision-safe filenames. Existing-concept proposals require a matching SHA-256 revision prefix at approval time.
- Durable folders keep immutable content-addressed releases and only replace the small latest-release pointer. Original OKF paths are normalized and rejected if they contain traversal segments.
- The self-host container uses a read-only root filesystem, drops Linux capabilities, enables `no-new-privileges`, and writes only to the mounted proposal inbox. The generated server applies the same scoped portal/MCP authorization and security headers as Daytona.

## Operational limitations

- Capability URLs authorize possession, not a verified human identity. Use one link per intended recipient, revoke it when membership changes, and prefer short sharing windows for sensitive material.
- Daytona’s current general and TypeScript SDK documentation conflict on preview inactivity, while Knot’s live probe confirmed that preview traffic currently keeps a running sandbox active. Fetching that same link after an explicit stop returned `400` and did not change the `stopped` state. A stopped sandbox must be restarted through Daytona by its owner in Knot; there is no hidden link-triggered wake relay. Always-available mode disables auto-stop explicitly and therefore consumes usage until stopped.
- Desktop binaries in local development are unsigned. Public macOS and Windows releases still require platform code signing and, for macOS, notarization.
- A public Daytona preview exposes the host to the internet. The in-host Knot authorization layer is required and must not be removed.
- A provider's unrestricted shared link and an R2/S3 presigned URL are bearer capabilities. Use the provider's named-user/group ACL when identity enforcement is required. Revoking an unrestricted provider link is provider-specific; revoking a presigned URL may require changing the object, key, or policy.
- Self-host operators own TLS, firewall policy, backups, updates, uptime, and capability rotation. Re-export and redeploy after a scope change or suspected access leak. Copy `data/mcp-proposals.jsonl` into the local `.knot/` inbox for review; never apply remote proposal text directly to OKF.

## Response actions

If a Daytona human or MCP capability may have leaked, revoke that grant from **Cloud & MCP**. For a synced folder, revoke or narrow the provider permission. For self-hosting, stop the service, export a new deployment to rotate every capability, and redeploy it. If the Daytona or Parallel key may have leaked, rotate it at the provider and remove it from Knot. **Delete cloud workspace** destroys the Knot-managed sandbox and revokes every hosted route; canceling a Web watch stops its scheduled usage, while removing the Parallel key deletes only the local credential.
