# Event and reporting definitions

The shared source of truth is `packages/contracts/events.ts`; `pnpm build` emits `docs/event-schema.json`. Unknown fields and type coercion are rejected at ingestion.

| Record | Contents / identity |
| --- | --- |
| Site | One exact origin; random public routing key, environment, enablement, sample rate, quota, supporting family/group metadata |
| Page | `(site_id,page_key)`; approved static path/query selector, revision, locale, variant, presentation state and stable element/action IDs |
| View | `(site_id,view_id)`; memory-only browser UUID, immutable context/config/sample rate, original view-start timestamp; no persistent person/session identity |
| Event | `(site_id,event_id)`; finite bounded geometry, sequence, elapsed milliseconds, segment UUID, viewport, strict type payload and context-covered receipt hash |
| Job / fact | One mutable durable job and one idempotent fact per view; recomputed from retained events |
| Reference | One page/release/locale/variant/state/document layer and exact viewport geometry; image checksum/private object key, elements/masks and review status |

Raw visitor addresses/referrers, query values, text, form values, cookies, account IDs, raw user agents and raw IPs are absent from the event schema. URL selectors in the registry are reviewed static configuration constants, not observed visitor URL strings.

Events: `page_view`, `segment_start`, `click`, `activation`, `progress`, `exposure`. Pointer positions are CSS pixels; document position is client position plus current scroll, without multiplying by device pixel ratio. Keyboard actions have no coordinates. Private/ignored regions are not represented by fake positions.

Counts use confirmed tracked page views. Out-of-order events may exist before a start; those orphan views are excluded until promoted. Page activation rate is distinct confirmed views with `registration-start` divided by confirmed views. Exposed-view activation uses the intersection of activated and qualified exposed views, divided by qualified exposed views. Clicks count repeated pointer events and are not an activation-rate numerator.

Scroll reach is `100 * min(document_height, scroll_y + viewport_height) / document_height`; scroll progress is `100 * scroll_y / max(document_height - viewport_height, 1)`. A fitting page has 100% reach and 0% scroll progress. Progress and visible milliseconds are cumulative within a geometry segment and merge by maximum. Geometry changes start a new segment.

The SDK qualifies approved CTA exposure after 50% intersection for 1000 continuous visible milliseconds. This is viewport exposure, not proof of attention or lack of occlusion. Tall sections do not yet have a separately implemented viewport-relative exposure policy; do not interpret their missing events as a lack of reading.

Pixel maps require a single selected property/page/revision, exact layout width and compatible document height. Fixed/sticky/zoomed/unsupported positions are excluded from the document map. Coordinates are binned into 8-pixel aggregate cells before delivery to the dashboard; the custom renderer applies a Gaussian-like kernel and labeled relative log density. These observations are not raw point downloads or total visitor estimates.

Whole-page rates deduplicate views. Scroll-reach bars use viewport-segment denominators. A resized view can appear in multiple device/geometry cohorts, so those totals are not additive. Data is sampled by complete view; all seeded local views use 100%. Best-effort delivery, consent refusal and sampling limit coverage. Reports display provisional/freshness/aggregation and exclusion metadata rather than implying complete traffic.

Aggregation v2 stores actions, exposed IDs, activated element IDs and pointer counts on each viewport segment. A device/exact-width report uses only matching segments before deduplicating views. Element activation among exposed views uses the exposure/activation intersection for that element. Old derived facts are reprocessed from retained events through migration 002; they are not silently relabeled.

UTC timestamps are stored, aggregate filters use UTC day boundaries, and human-readable local timestamps display Europe/Bucharest. No market or visitor jurisdiction is inferred from a hostname.
# Activity provenance

`views.data_source` is assigned internally: `recorded` for collector-received activity, `seeded` for explicit sample generation, and `legacy` for mixed historical rows that predate provenance. The public event schema accepts no data-source field. All reports default to `recorded`; an explicit `data_source` filter selects exactly one source. No source is merged into recorded metrics. Legacy rows are retained without guessing which represented human or generated activity.


## Analytics 0.3.0 additions

`pages` adds approved `campaign_codes`, `diagnostics_enabled`, `diagnostic_error_codes`, `primary_cta_id`, and `primary_action_id`. `events` accepts strict generic `diagnostic`, numeric `performance` and cumulative `delivery` variants; raw error content is not accepted. Aggregation-v3 segment facts add timestamped exposure/action journeys, diagnostic counts/linked positions and performance maxima. View facts add `page_view_at` and cumulative delivery maxima. No session replay or persistent visitor identifier is introduced.

`operation_runs` stores kind, state, timestamps, generic outcome/error code and operational details. `operation_alerts` stores fixed code/severity, active/resolved state and counts/times. `settings.operations` stores UTC schedules and alert thresholds. Monitor history expires after 30 days; other maintenance audit/history persists. See [analytics definitions](ANALYTICS_UPGRADE.md).

## Chart report projections

Report and portfolio `timeseries` contain UTC calendar-day points derived from scoped confirmed facts: views, clicks, primary CTA exposure, ordinary and ordered activation counts, diagnostic/delivery counts, receipt delay counts and observed timing percentiles. Empty local-count days are zeros; absent timing samples and privacy-suppressed real-data buckets stay unavailable. `devices` counts selected viewport segments per device and applies real-data cohort suppression. These projections are computed at read time and do not create tracking events or persist invented measurements.
# Acquisition dataset · 0.4.0

The acquisition ledger is separate from sampled SDK views. `acquisition_visits` stores an issued visit/assignment, host-supplied campaign/device, server-owned market/product/brand/locale/family/currency context, a site-scoped hash of a random host unit, consent policy and a fixed attribution window. Raw unit tokens are never persisted. `acquisition_outcomes` stores retry-safe backend-confirmed `registration_completed` and `qualified_acquisition` events. Their counts are not inferred from clicks, CTA actions or exposure.

Optional SDK `context.acquisition_id` links a consented view to its confirmed rendered assignment. Non-base variants require a matching site/page/source/revision/campaign and an active or paused experiment. `views.acquisition_context` snapshots server-owned page/market dimensions at view creation. Older rows without these dimensions remain unknown.

Acquisition report units are deduplicated within site/page/campaign/context; adding rows does not yield globally unique people. Experiment primary denominators are all assigned eligible units whose full attribution window has matured, independent of SDK sampling or CTA exposure. Pending windows block a final result. The allocation check includes all assigned units. Daily spend remains currency-separated and produces no cost metric without matching days, closed windows and explicit scope/coverage reconciliation.

Frozen experiment readouts retain aggregate counts and statistics after raw retention. Unfrozen experiments with expired evidence or consent deletions cannot declare a conclusive result. Withdrawal deletes the site-scoped unit's visits/outcomes and linked raw SDK evidence. See [the complete definitions and integration contract](ACQUISITION_EXPERIMENTS.md).

