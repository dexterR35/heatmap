# Analytics upgrade · 0.3.0

The six requested upgrades are implemented in the local application. Open the dashboard at `http://127.0.0.1:3000` and refresh its browser tab after updating. The existing account and recorded activity are preserved. Real-property collection remains disabled by the independent collector gate; external production infrastructure has not been deployed.

Interactive Recharts v3 views are documented in [CHARTS.md](CHARTS.md). They share report scope and preserve missing/suppressed observations.

## Campaign analysis

**Campaign analytics** compares authorized landing pages by tracked views, pointer clicks, qualified primary CTA exposure, ordered activation, scroll reach and experience signals. Select UTC dates, device, data source and an approved campaign code. The table shows each page's revision and observed sample rates. Each page retains its own denominator. Counts are observed sampled views, not estimated traffic or unique people.

Recorded activity is the default. Generated samples and earlier unclassified data remain separate. A real-data page below the privacy threshold has its counts suppressed and contributes no counts to portfolio totals. A zero-view synthetic page can be shown with zero observations.

In **Installation → Approved campaign and diagnostic policy**, an owner or scoped administrator can register public campaign codes, choose the primary registered CTA/action, set the published revision, and enable numeric diagnostics. `unknown` must remain allowed. The Marketing host supplies `campaign` as a reviewed static code through `InfraredHost.setContext`; the SDK never derives attribution from raw URL parameters. An unregistered code disables SDK collection and is rejected at ingestion.

## Ordered funnel and additional metrics

**Conversion funnels** measures these steps within a tracked view and the selected device/viewport/revision/campaign cohort:

1. A confirmed `page_view`.
2. Qualified exposure of the selected primary CTA: at least 50% viewport visibility for at least 1 second.
3. Activation of that same registered CTA and primary action after its exposure.

An activation before exposure, an activation of another element, or an action from an excluded viewport segment cannot complete the ordered funnel. Any primary-action activation remains available separately in the ordinary page activation metric. Registration completion and revenue are not inferred. Those require a separately approved backend contract, attribution design and privacy review.

The funnel shows a 95% Wilson interval for activation among exposed views, flags cohorts under 20 views, and reports median time to first primary action with its observed-view sample count. “Engaged” means an action, at least 10 seconds observed visible time, or at least 75% scroll reach. “Observed quick exit” means positive visible time below 10 seconds without a primary action. It is not a reconstructed bounce/session measurement. These operational definitions support investigation; they do not establish causation or user intent.

## Heatmaps and page versions

**Heatmaps → Mapping** supports two distinct choices:

- Document pixels require an exact viewport and compatible document height. Fixed/sticky/transformed/zoomed observations are excluded.
- Registered elements use the captured element ID and relative click fractions to place clicks inside that element's approved reference rectangle across responsive layouts. Unregistered targets stay unmapped. Approved masks are applied again after remapping. The source device filter still applies; choose All devices deliberately when combining responsive source layouts.

Click, scroll-reach, element, repeated-click and possible-no-response views are available. Diagnostic overlays refer to actual retained click IDs/positions. Maps use relative log density, and version cards have independent scales. A map is unavailable without a compatible approved reference; counts can still be available.

**Page versions** retrieves independent cohorts and reference layouts for two revisions. Revision choices come from observed source history plus the current registry. A single observed revision is shown honestly; a second cohort is not fabricated. Updating the published revision in Installation does not rewrite past events. Publish matching host context, update the registry, import/review its reference, and collect new consented views. Old browser contexts stop matching and need the new release. Local automatic capture remains limited to the built-in `demo-v1` fixture; other revisions require reviewed image/manifest import. Version differences are observational and do not constitute an A/B experiment.

## Experience diagnostics and privacy

Diagnostics start only after analytics consent and eligible public context, and only when enabled for that page. Withdrawal destroys listeners, observers, pending click checks and the memory queue. The per-view diagnostic/performance budget is 40 signals; no-response checks have at most five concurrent observers.

- Repeated-click clusters: three nearby document clicks within 32 pixels and 1 second, with a 1-second cluster cooldown. These are suggestive signals, not proof of frustration.
- Possible no-response clicks: a public interactive control produced no observed public DOM/navigation/scroll response within 1 second. This heuristic can miss responses or flag legitimate controls. Reports link the signal to a real click in the same view/segment within 5 seconds and count that click once.
- Generic approved error codes: `runtime-error` and `unhandled-rejection`. No error message, reason, stack, filename, URL, page text or form value is read into the event payload. Extra fields are rejected by the collector's strict schema.
- Numeric performance: navigation load, FCP, LCP, observed interaction duration, and cumulative post-consent layout shift where the browser supports them. Private targets/sources are excluded. Buffered page timing may describe load before the consent click, but is transmitted only after permission. Interaction duration is not standardized INP; post-consent layout shift is not a claim of full-page CLS. Reports use per-view maxima and show p50/p75/p95 with sample counts. Missing browser support or history stays unavailable.

## Data quality and investigation ideas

Report quality shows mapped/unmapped categories, pending facts, aggregation-v3 coverage, observed sample rates, processing freshness and events received over 60 seconds after their declared occurrence. Delay quantiles use each view's maximum observed delay. Client delivery counters are cumulative maxima per view, preventing repeated snapshots from inflating retries/drops. A browser that never reconnects cannot report its losses; zero reported drops does not establish perfect delivery.

The investigation shortlist uses transparent rules and at least 20 tracked views: low primary CTA exposure, at least three repeated-click clusters, or at least three possible no-response clicks. Every item carries supporting counts. It proposes checks; it does not invent an automated diagnosis, causal uplift, or marketing result.

Collector rejection counters remain process-wide and separate from page cohorts, because rejected payloads cannot be safely attributed to a valid page/view. In separate-service mode the management process cannot see another process's in-memory collector counters. Use the exported collector metrics for those alerts; an unavailable counter is not reported as a measured zero.

## Maintenance, recovery and monitoring

**Operations** is owner-only, protected by the existing private session, Host, Origin and CSRF checks. It provides durable run history, active/resolved alerts, manual retention/backup/monitor runs and schedule controls.

- Retention defaults on, after 02:00 UTC daily, using the existing privacy rules. The management scheduler checks every minute while running; a missed schedule runs on a later check after its hour. No work happens while the application is stopped.
- Automatic logical backup defaults off. Enable it after choosing a private destination (`HEATMAP_BACKUP_DIR`, default `DATA_DIR/backups`). The default schedule is after 03:00 UTC with seven days retained. Backup and retention claims cannot overlap, including across management replicas sharing a database.
- Backups read a consistent repeatable-read database snapshot, copy only registered immutable reference images, checksum both, stage then rename, and read back to verify before reporting success. Sessions are excluded. Existing targets are never overwritten. Only verified scheduler-owned backup directories matching the fixed naming convention are eligible for expiry.
- Restore verifies checksums before loading an empty destination. The synthetic persistent database/reference roundtrip is tested. These local logical copies contain password hashes and are not encrypted or offsite by default. They do not replace production PostgreSQL/PITR or an infrastructure restore drill.
- Alerts cover failed worker jobs, queue lag, rejection ratio (at least 20 ingestion requests in a 5-minute process window), backup failure and overdue automatic backup. Interrupted operations are recovered after 30 minutes. Monitor history is retained for 30 days. Alerts persist locally; external notification delivery has not been configured.

Set `HEATMAP_OTEL_METRICS_ENDPOINT` to an OTLP/HTTP metrics receiver including `/v1/metrics`, then restart. Plain HTTP is allowed only on loopback; a remote receiver requires HTTPS. No exporter starts without configuration. Every process exports its own service metrics; independent workers also export processing counts. Management/worker database gauges include queue state, queue age and successful-operation timestamps. Export failure does not gate event acceptance. Telemetry carries route templates, method/status, aggregate counts/timings and fixed operational categories; it omits concrete URLs, visitor/view/site identifiers, payloads and IPs.

| Instrument | Meaning |
| --- | --- |
| `heatmap.http.requests` | Counter by service, route template, method and response status |
| `heatmap.http.duration` | Request duration histogram in milliseconds |
| `heatmap.worker.processed` | Completed derived-view computations in independent worker mode |
| `heatmap.queue.jobs` | Durable job count by fixed state |
| `heatmap.queue.oldest_seconds` | Age of oldest pending/processing work |
| `heatmap.operation.last_success` | Successful maintenance completion Unix timestamp by kind |

Configure the receiving monitoring platform to alert on sustained HTTP server errors/rejections, queue lag/failed work, absent telemetry and overdue successful backups. Dashboard counters describe the current process lifetime; durable job/maintenance state survives restart. Corporate OIDC/MFA, HTTPS ingress, offsite encryption, external alert routing, real PostgreSQL role isolation and capacity validation still require deployment configuration/evidence. See [production readiness](PRODUCTION_READINESS.md).

## Implementation and validation

Migration 004 adds page policies and durable operation tables, preserves all existing source classifications, and requeues retained older facts once for aggregation v3. The SDK event protocol remains v1 with additive strict event variants; the config advertises diagnostic/delivery features. The immutable SDK filename and SRI change with the built bytes.

New coverage exercises funnel order and resize cohorts, diagnostic deduplication/relative positions, performance/delivery aggregation, approved campaign scope, policy RBAC, raw error-field rejection, disabled diagnostics, responsive masks, independent revisions, operation claims/recovery/alerts, backup corruption, actual browser diagnostic transport, consent teardown and the new desktop/mobile screens. Browser tests use disposable databases and random loopback ports, keeping test interactions out of the user's recorded activity.

Primary references: [OpenTelemetry JavaScript instrumentation](https://opentelemetry.io/docs/languages/js/instrumentation/), [PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver), [browser error events](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event), [LCP measurement](https://web.dev/articles/lcp).
