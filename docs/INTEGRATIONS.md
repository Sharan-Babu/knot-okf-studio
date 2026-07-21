# Integration research and product decisions

Research checked 2026-07-17. This note records the product boundary, not just implementation mechanics.

## Daytona availability, sleep, and wake

Daytona exposes explicit start, stop, pause, archive, auto-stop, auto-pause, and auto-delete lifecycle operations. A stopped sandbox is started through the authenticated Daytona API/SDK. The current general sandbox guide says preview network requests reset inactivity, while the current TypeScript SDK reference says preview interactions are not included. That documentation conflict affects whether an *already running* sandbox remains active; neither source documents a preview URL starting a stopped sandbox.

Knot therefore makes two honest availability modes available:

- **On demand:** auto-stop after 15–120 idle minutes. When it stops, every portal/MCP link is offline until the owner starts it in Knot.
- **Always available:** set Daytona auto-stop to `0`. Links stay available, but usage continues until the owner stops the sandbox.

Knot never promises link-triggered wake. Daytona webhooks are outbound lifecycle notifications, not an inbound request relay.

The sound future fix is an optional **wake gateway** on an always-on edge runtime. It would hold the owner’s Daytona credential in that provider’s secret store, accept only a scoped opaque share ID, rate-limit requests, call Daytona start, poll Knot `/health`, then redirect/proxy to a newly fetched preview URL. It must not put the Daytona key in a browser, capability URL, OKF bundle, or sandbox. It also introduces an always-on service and should be opt-in. Until that exists, the product offers on-demand owner start or explicit always-on operation.

Live verification with the temporary test account used a one-minute auto-stop and fetched the preview at 0, 20, 40, 60, and 80 seconds. Every request returned `200` and the sandbox was still `started`, so the current Daytona backend treats preview requests as activity for an already-running sandbox, matching the general sandbox guide rather than the TypeScript reference text. Knot then stopped the sandbox, fetched the same link, received `400`, waited, and verified the state remained `stopped`. Thus preview traffic currently postpones idle stop, but a stopped link does not trigger wake. The repeatable probe is `node scripts/daytona/wake-behavior.mjs`; it deletes its labeled sandbox in `finally`.

### Windows account-capability audit

The supplied API key was also tested against the current organization, usage, snapshot, region, and quota APIs without persisting it. At the last audit the US region reported Windows quota of 2 vCPU, 8 GiB RAM, and 30 GiB disk with zero usage, and the active `windows-small` profile (1 vCPU, 4 GiB, 30 GiB) fit it exactly. Two bounded release runs—first 6 attempts and then 15 attempts—still returned `No available runners`. This is distinct from quota or request throttling: the last response was HTTP 400 with 595 of 600 sandbox-create requests remaining. A narrowly scoped attempt to change only regional Windows disk quota returned `403 Invalid authentication context`: the sandbox-management API key cannot perform that organization-authenticated quota change.

Creating a custom region or runner record is not a remedy by itself. Daytona schedules onto physical runners, dedicated regions are provisioned through Daytona, and BYOC requires the customer to deploy the documented region services and runner infrastructure on their own Kubernetes/AWS compute. An empty control-plane record would still have no Windows machine on which to schedule. Knot therefore does not mutate billing, create a new organization, or leave dead runner/region records behind. The safe native-Windows paths are restored provider shared-runner capacity, a Daytona-provisioned dedicated region, or real compatible BYOC infrastructure. `scripts/daytona/account-audit.mjs` records the bounded account evidence, `scripts/daytona/windows-quota.mjs` performs only an explicit quota request, and `scripts/daytona/windows-release.mjs` records target, requested retries, failure class, and cleanup state.

Primary references:

- [Daytona sandbox lifecycle and inactivity rules](https://www.daytona.io/docs/en/sandboxes/)
- [Daytona TypeScript sandbox API](https://www.daytona.io/docs/en/typescript-sdk/sandbox/)
- [Daytona preview access](https://www.daytona.io/docs/en/preview/)
- [Daytona webhooks](https://www.daytona.io/docs/en/webhooks/)
- [Daytona regions and dedicated runners](https://www.daytona.io/docs/regions/)
- [Daytona Bring Your Own Compute](https://www.daytona.io/docs/en/bring-your-own-compute/)
- [Daytona account limits](https://www.daytona.io/docs/limits)
- [Daytona organizations and usage](https://www.daytona.io/docs/en/organizations/)

## Durable availability destinations

An interactive MCP server and a durable file delivery are different products. A stopped Daytona sandbox cannot serve either a portal or MCP. Drive, Dropbox, and Box can keep a selected OKF release available without compute, but they cannot execute Knot's Streamable HTTP MCP server. Knot exposes those differences instead of presenting every destination as equivalent.

### Synced folder: implemented

Knot can publish the selected scope to a folder already synchronized by Google Drive for desktop, Dropbox, Box Drive, Syncthing, or another filesystem client. This avoids embedding vendor OAuth client registrations in a local-first release. The output has a stable root and immutable content-addressed releases:

- `index.html` and `current.json` point at the newest release;
- `releases/<revision>/` contains a static portal, original OKF Markdown, and a transparent manifest;
- earlier releases remain available for rollback and audit;
- republishing updates the shared root rather than requiring a new provider link.

The provider—not Knot—enforces sign-in, domain policy, expiry, and revocation. Google Drive supports user, group, domain, and anyone permissions. Dropbox shared-link settings support audience, expiry, and password controls depending on the account. Box shared links support open/company/collaborator access, expiry, and password settings, while named collaborators provide identity-bound access. A provider's unrestricted link is still a bearer capability; selecting a person's name in Knot does not upgrade it into identity federation.

Primary references:

- [Google Drive sharing permissions](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
- [Google Drive downloads and `webContentLink`](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
- [Dropbox shared-link API](https://dropbox.github.io/dropbox-sdk-js/Dropbox.html)
- [Dropbox shared-link settings](https://dropbox.github.io/dropbox-sdk-js/global.html)
- [Box shared links](https://developer.box.com/guides/shared-links/)
- [Box shared-link removal](https://developer.box.com/guides/shared-links/remove/)

### Self-hosted portal and MCP: implemented export

Knot can export the same selected scope as a deployable Docker Compose kit. It includes the bundled portal/MCP service, hashed access grants, one-time capability material in a separate `ACCESS.md`, a read-only container root, dropped Linux capabilities, `no-new-privileges`, and a writable proposal inbox under `data/`. A user can run it on a VPS, NAS, home server, or private network. The user-controlled host determines sleep, wake, TLS, backups, and uptime. The generated README requires an HTTPS reverse proxy before sharing credentials.

This is a real Streamable HTTP MCP host, unlike a Drive-style folder. Updating knowledge or rotating capabilities currently means re-exporting and redeploying the kit. The durable `data/mcp-proposals.jsonl` inbox is deliberately separate from source knowledge so no external client can write OKF directly.

### Direct cloud-object adapters: researched next step

An S3-compatible target such as Cloudflare R2 is the strongest future direct static adapter: upload the immutable release and use either a custom domain/public bucket or short-lived presigned URLs. Presigned URLs are bearer capabilities with an expiry, not identity federation, and cannot generally be revoked immediately without changing the object, key, or access policy. CORS also has to be configured for browser access. It remains a static delivery route; dynamic MCP still needs compute.

- [Cloudflare R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)

Direct Google Drive, Dropbox, and Box adapters are also sound future work when product-owned OAuth registrations and provider review are in scope. They can create/revoke links and, where supported, set named account ACLs. The synced-folder path is usable now and keeps provider credentials out of Knot.

## Notion as an optional synced place

Notion can be a useful *collaboration projection* of an OKF workspace, but it should not become Knot’s canonical store by default. OKF Markdown remains portable, diffable, agent-readable, and user-owned; Notion pages are block trees with workspace permissions and API-specific representations.

Recommended model:

1. User connects through OAuth for a multi-user product, or an internal integration for one workspace, and explicitly chooses a parent page/data source.
2. Knot keeps a local mapping of `OKF document ID ↔ Notion page ID`, last OKF revision, last Notion edit timestamp, and last common revision. Tokens stay in the OS-protected vault.
3. Initial push creates one Notion page per concept and maps stable OKF metadata to page properties. Markdown body becomes supported Notion blocks; the OKF document ID and revision are stored in integration properties.
4. Pull recursively retrieves paginated block children. Notion returns only one child level at a time, so nested content requires bounded recursive requests.
5. Notion webhooks signal page/data-source changes but do not contain the complete changed content. A public HTTPS receiver verifies the Notion signature, deduplicates the event, then fetches the page. A local-only desktop can instead poll when opened.
6. One-sided changes produce a normal push/pull proposal. Two-sided changes produce a three-way conflict; Knot never silently overwrites either side. Pulls enter the same human-review workflow used by documents, MCP proposals, and web updates.
7. Unsupported/read-only Notion blocks are preserved as references or warnings rather than discarded. API version is pinned and migrated deliberately; the current `2026-03-11` version changed block insertion and trash semantics.

Operational constraints include recursive pagination, an average API limit of three requests per second, retrying `429` with `Retry-After`, 100-element arrays, and a 500 KB request body. For these reasons a background job queue with per-page checkpoints is safer than synchronous whole-workspace mirroring.

Primary references:

- [Notion webhooks](https://developers.notion.com/reference/webhooks)
- [Notion webhook event delivery](https://developers.notion.com/reference/webhooks-events-delivery)
- [Working with page content](https://developers.notion.com/guides/data-apis/working-with-page-content)
- [Retrieve block children](https://developers.notion.com/reference/get-block-children)
- [Notion request limits](https://developers.notion.com/reference/request-limits)
- [Notion API 2026-03-11 upgrade guide](https://developers.notion.com/guides/get-started/upgrade-guide-2026-03-11)

Decision: document and preserve this sync design now, but do not pretend a tokenless mock is a production Notion integration. It should be implemented once OAuth/public webhook deployment is in scope. Ingestion from exported Notion HTML/Markdown can already use Knot workflows today.

## Parallel web update monitoring

Knot now integrates Parallel Monitor as **Web watch**:

- API key encrypted by Electron `safeStorage`, never written into OKF.
- focused natural-language event-stream monitors with 1 hour–30 day schedules and `lite`/`base` coverage;
- explicit check-now polling, which fits a local desktop without inventing an always-on webhook receiver;
- deduplicated update inbox with event content, citations, reasoning/confidence when present;
- cancel control to stop scheduled usage;
- three user decisions per update: dismiss, prepare a deterministic cited draft, or prepare with the user’s signed-in Codex subscription;
- every prepared item becomes a normal workflow proposal. Nothing is written until a human approves it.

For a future hosted team service, verified Parallel webhooks can reduce polling. The event payload supplies an event-group ID; the service then fetches the complete events and basis. Webhook verification, idempotency, replay defense, and tenant routing are mandatory. Monitor queries should not contain private OKF content, secrets, or personal data, and active monitors should remain visible because every schedule consumes usage.

Primary references:

- [Parallel Monitor quickstart](https://docs.parallel.ai/monitor-api/monitor-quickstart)
- [Parallel Search API](https://docs.parallel.ai/api-reference/search/search)
- [Parallel API overview](https://docs.parallel.ai/getting-started/overview)
