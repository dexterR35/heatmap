# Local operations

## Seeing your actual local clicks

Open the test landing page `/casino/?lp=halloween` on the configured demo origin (default `http://127.0.0.1:4173`). Reload it and select **Allow demo analytics**. The header should show **Recording clicks** and your viewport width. Click public content, then open Dashboard → Heatmaps → Halloween casino with **Recorded activity** selected. Reports refresh every three seconds; the worker normally processes within another second.

If the header says Collection paused, check the global stop and selected page enablement. If it says Analytics off, consent or another eligibility/privacy gate is preventing tracking. A different viewport needs a matching reference: choose **Add a reference layout**, capture the observed width, review/approve it, and use that layout. Counts can be available before an overlay has a compatible screenshot. The public page content is fictional; the interactions in Recorded activity are collected browser observations.

Earlier mixed counts are preserved under **Earlier data · unclassified**. Explicitly generated examples appear only under **Generated samples**. They never inflate the default recorded report. Reload both old browser tabs after updating so they load the new source selector and SDK artifact.

`pnpm test:e2e` starts its own disposable local services/database on random ports and cleans them up on completion. It does not add test clicks to the running user workspace. `pnpm exec playwright test` is the lower-level runner and should be reserved for an explicitly configured fixture.

## Startup, shutdown and data

Use `pnpm start` after building. The three Fastify applications bind to loopback and have separate route sets. The worker runs in the same local Node process. Native persistence is PGlite in `.local/database`. Do not open that directory with a second process while the server is running. Use Ctrl+C for a graceful shutdown; durable pending jobs survive restart.

Use `pnpm run doctor` to see runtime, artifact size/SRI, storage presence, and port availability without printing secrets. Use the explicit `run` because this pnpm version also has a built-in package-manager `doctor` command. An in-use port can be expected when the application is running. Health is `GET http://127.0.0.1:8080/healthz`; it exposes no database details.

With the server running, `pnpm verify:links` authenticates using the local administrator file or configured administrator environment variables and checks local application links, SDK integrity and CORS. It refuses non-loopback origins and never visits real property URLs. Results are saved to `.local/evidence/link-check.json`. Each invocation counts toward the login limit of eight attempts per ten minutes per source. Security regressions can be run separately using `pnpm test:security`.

Never tunnel port 3000, the database directory, management API or screenshot files. This local release does not provide an externally reachable live collector. A public page cannot send all visitors' events to an operator's localhost.

## Processing and recovery

Ingestion commits immutable view context, event receipt/hash, raw event, atomic site/day quota and a durable view job in one transaction. Duplicate event IDs with matching hashes are no-ops; conflicting hashes roll back the batch. Failed database work is not acknowledged.

The worker persists a bounded claim using `FOR UPDATE SKIP LOCKED`, then recomputes the retained view deterministically. It verifies lease ownership before atomically replacing its fact and marking completion. Re-running a job cannot add a view twice. Expired processing leases are eligible again. Failed computation attempts persist, back off exponentially, and enter `failed` after five tries. No event body is logged. A failed job remains visible in Data Quality for investigation.

Clicks arriving before `page_view` are retained as orphan facts and excluded from default denominators/maps. A later start promotes the view once. Progress/exposure totals merge cumulatively using maxima. Rates count distinct confirmed views and exposure/action set intersections, never the sum of click events.

## Retention

Automatic daily retention is enabled in Operations (02:00 UTC by default) while management is running. Change privacy rules in Settings; Operations also provides an online **Apply retention now** action. For the offline CLI, stop the server and run:

```powershell
pnpm retention
```

Default raw-event/view/fact/job retention is 30 days, reference retention is 90 days. Unprocessed views are protected from pruning. Expired references are removed from both registry and private storage. Expired sessions and old quota buckets are pruned. Audit records are retained in this local release. There is no permanent rollup history beyond retained facts, so old reports cease to be available when their underlying data is deleted.

The management scheduler checks every minute, using durable database claims to prevent competing backup/retention work. Automatic backup is opt-in in Operations; scheduler-owned verified backups expire according to its backup-days setting. Production deletion approvals, offsite backup protection and restore drills remain deployment work. A shorter retention setting does not instantly delete records in the Settings request.

## Backup and restore

Operations → Create verified backup runs safely online. Automatic backups are off until enabled; configure a private `HEATMAP_BACKUP_DIR` before enabling them. For either CLI command below, stop the server first. Choose a private destination outside `.local`:

```powershell
pnpm backup C:\ApprovedBackups\heatmap-2026-10-16
```

The backup contains a logical database JSON snapshot plus private reference files. It includes password hashes and potentially personal event data; protect it and apply approved access/retention rules. No session tokens are included. The command refuses to overwrite any existing destination and verifies database/reference SHA-256 checksums by reading them back.

Restore only to a fresh, empty database; existing populated databases are rejected:

```powershell
# Choose a NEW, empty target; do not delete the current data.
$env:DATA_DIR = 'C:\ApprovedRecovery\heatmap-restore-test'
pnpm restore C:\ApprovedBackups\heatmap-2026-10-16
Remove-Item Env:DATA_DIR
```

Use the restored users' existing passwords. Sessions are not restored. Before replacing an operational instance, verify site/page counts, a reference checksum and metrics in an isolated loopback test. The logical backup roundtrip is tested with synthetic data; this is not evidence of a company production restore exercise. Neither local JSON backup nor PGlite persistence substitutes for a production PostgreSQL backup/PITR design.

For schedules, persistent alerts, metric names and diagnostic definitions, see [the analytics guide](ANALYTICS_UPGRADE.md).

## Capture and manual import

`pnpm capture` starts a separate Playwright process with a minimal environment, no database module, and no administrator/database secret. It is limited to explicitly synthetic `127.0.0.1` URLs, blocks other request origins, preserves the query selector, hides the demo CMP and privacy widget, and writes staging artifacts. The trusted parent authenticates to the management API to import them. No real customer browsing context is captured.

The References screen also starts a selected-page capture through the private API. It persists a job, limits concurrency to one, checks the actual fixture's release/context, and leaves the imported reference pending review. Interrupted capture work is marked failed on restart. Review/approve the full image and select **Use this layout**; reference approval is never inferred from capture success.

The capture runner is a local fixture tool. It is not an approved sandbox for untrusted external websites. Real URL capture is disabled. Operators can instead import approved PNG/WebP and JSON manifests through References and review them before approval.
