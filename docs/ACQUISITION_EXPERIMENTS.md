# Acquisition and experiments · 0.4.0

This release extends the custom platform across selected Casino/Sport landing pages and markets. It runs locally; real-site collection and external capture remain independently disabled. No integration has been installed on a real customer page. The supplied `https://uk.landing.example.com/casino/?lp=summer-wo` is a disabled UK Casino draft. An HTTP inspection received 403, so its actual DOM, consent integration, redirects and offer content remain unverified.

## Using the workspace

1. Open **Manage → Markets & registry**. Edit a page's details, paste an array of registry rows or load JSON. Validate the batch, inspect its row-level errors/plan, then apply. All rows are revalidated on apply and commit together. A new real-site page stays disabled/pending. Export produces JSON for review/reuse.
2. Use Market, Product and Brand filters in the registry, landing-page list, Overview, Acquisition and Experiments. Page identity remains exact origin + exact path + approved `lp` value. Unknown query values are rejected. Site brand/currency/timezone and page market/locale/family/goal are explicit configuration, not IP-derived assumptions. The Sport path must be provided from the actual approved inventory; it is not inferred from the Casino URL.
3. Open **Analysis → Acquisition** for backend-registered visits, registrations and qualified acquisitions. This is a separate dataset from sampled heatmaps. Set dates and website/device scope. Reconcile daily campaign spend under its expandable panel. No totals combine currencies. A missing spend day, open attribution window, unknown outcome coverage, no acquired customer or a device slice without cost allocation makes acquisition cost unavailable.
4. Open **Analysis → Experiments**. Start with an A/A measurement check; create an A/B test after the host integration is validated. Specify the primary outcome, expected baseline, meaningful relative effect, minimum active days and attribution window before starting. The control code must match the page's base variant; each candidate code is unique within its page revision. A/A variants must actually render the same host content.
5. Start, pause/resume or close assignments. A completed experiment cannot reopen. Backend outcomes may still arrive inside their original occurrence window until the final readout is explicitly frozen. Review sampled experience guardrails before rollout. No automated rollout is implemented.
6. When all fixed-horizon checks pass, **Freeze final readout** creates an immutable aggregate result. New outcome changes for that experiment are rejected. That snapshot survives raw-data expiry. If an unfrozen experiment loses raw evidence or has privacy deletions, it remains inconclusive. Anonymous frozen aggregates can remain after individual evidence deletion.

The report date boundary is explicitly UTC; displayed readout times use Europe/Bucharest. Registry timezones document local market context, but this release does not claim arbitrary local-calendar report boundaries or currency conversion. Market/device slices are exploratory; no single winner is inferred across all markets.

## Local end-to-end lab

Create/start an experiment for Halloween or Christmas. Click **Open consented experiment lab** (native combined mode, `/experiment-lab/` on port 4173). Choose the experiment and start its consented preview. The host registers a random memory-only unit, receives a stable assignment for that tab, renders the actual variant, confirms it, then enables the ordinary SDK. The A/B candidate has different CTA copy/color; A/A keeps the same content.

Click the embedded page to record actual local usability activity. **Complete demo registration/acquisition** calls the synthetic backend; it does not register a person or perform a financial transaction. Both the environment and UI identify this as a local fixture. **Privacy choices** withdraws SDK consent and removes the site's linked acquisition/heatmap evidence. No events are generated on a real page.

The separate **Generate sample outcomes** action creates explicitly `seeded` examples with historical timestamps. It never adds to recorded outcomes, and its readout always says SAMPLE DATA. Repeating generation reuses sample units. Do not interpret generated effect sizes as observed uplift.

## Backend integration contract

Create a key under **Acquisition → Connect backend acquisition data** for one website. The random secret is shown once, stored only as a hash, revocable and site-scoped. Keep the key on the backend. Requests use `X-Acquisition-Key`; browser requests with an Origin header are rejected. The local collector is `http://127.0.0.1:8080`. A production endpoint must use the approved HTTPS infrastructure.

`POST /v1/acquisition/visits`:

```json
{
  "receipt_id": "random UUID reused for a retry",
  "page_key": "casino-halloween",
  "unit_token": "at least 32 random base64url characters supplied by the host",
  "campaign": "unknown",
  "device": "desktop",
  "analytics_consent": true,
  "public_context": true,
  "policy_version": "demo-v1",
  "experiment_id": "optional experiment UUID"
}
```

The example strings describing UUIDs/tokens must be replaced with actual values. Fields are strictly validated and extra fields rejected. Campaign codes must be registered. Without an experiment, a visit uses the page base variant and a seven-day attribution window. With an experiment, the 50/50 deterministic salted bucket is stable for `(site, experiment, host unit)` and the attribution window is the prespecified one. Repeated requests for an assigned unit return its original visit/variant/campaign/device. Use those returned values; do not relabel the original acquisition when the user revisits from another campaign. The host must supply stable random tokens across the approved unit's measurement period. Emails, phone numbers, account identifiers, fingerprints and raw advertising URLs are not token sources. The SDK itself creates no persistent identity/cookie.

`POST /v1/acquisition/rendered` takes `visit_id`, `variant`, `revision`. The backend must report what actually rendered. Mismatched variants are rejected; missing confirmations block experiment conclusions. After successful rendering, pass the returned visit ID as `acquisitionId` in `InfraredHost.setContext`, along with the matching variant/revision/campaign. Ordinary SDK consent/public-context gates still apply. Acquisition counts are not contingent on downloading the SDK or on its sampling choice.

`POST /v1/acquisition/outcomes` takes `event_id`, `visit_id`, `kind` (`registration_completed` or `qualified_acquisition`) and `occurred_at` (ISO timestamp). Only send backend-confirmed business outcomes. A CTA click is not completion. The same event ID with a changed payload conflicts; retries and multiple receipts for the same visit/kind cannot increase its count. Reuse one stable event UUID for the same underlying business outcome across retries and attribute that outcome to one qualifying visit. Event occurrence must fall between visit creation and its fixed deadline; receipt may be delayed, subject to retained evidence and final-readout freeze. Decide the downstream qualified-acquisition definition with Marketing (for example, the agreed first-time customer event) before comparing results.

`POST /v1/acquisition/withdraw` takes `visit_id`. It deletes all acquisition visits/outcomes for that same site-scoped unit and linked raw SDK views/events/facts/jobs. It works even when collection is paused or globally stopped, is retry-safe, and never deletes another site's evidence. The host must forward consent withdrawal and stop sending subsequent events. An unfrozen experiment that lost recorded units displays PRIVACY EXCLUSIONS and cannot declare a winner. Old frozen anonymous aggregates retain their point-in-time counts.

The reference adapter in `config/acquisition-host.example.ts` validates the backend endpoint and demonstrates these calls without embedding a key in browser code. Company-specific identity, consent, cross-domain handoff, business-outcome source and attribution integration still require the actual host systems. Do not assume tracking coverage is complete just because callbacks succeed.

## Statistical and visual definitions

- Primary experiment rate: deduplicated primary-outcome successes / all assigned, fully matured eligible units in that experiment/source. It is never conditional on CTA exposure/click or successful SDK delivery. All assigned units enter allocation and rendering integrity checks. Open windows are shown separately and block a final result.
- Planning: equal 50/50 allocation, independent binary units, two-sided alpha .05, power .80; sample size is a normal-approximation estimate from the prespecified baseline/MDE. This is not observed-effect power. Active duration excludes paused periods.
- Readout: Newcombe difference interval built from Wilson limits, 95% confidence. Relative lift is unavailable with a zero control baseline. SRM uses a 50/50 Pearson chi-square tail at .001. Small samples still fail the independent power/duration checks. Evidence of primary-metric improvement is distinct from practical effect size and operational rollout review.
- No final winner while running/paused, underpowered, unmatured, missing render confirmations, allocation-mismatched, evidence-pruned or privacy-excluded. An A/A pass is a measurement check, not an optimization winner. Repeated monitoring is descriptive; fixed-horizon decisions occur only after closure and validity checks. Multiple separately run experiments/market comparisons are not automatically familywise-adjusted.
- Experiment heatmaps use only SDK views linked to that experiment's issued assignments. Each reference matches its variant/revision/locale/state and geometry. Capture can render registered local candidate variants without visitor activity, then requires explicit image review/approval. Real references still require reviewed imports.
- Shared comparisons use one linear kernel-density maximum across both maps, either raw clicks or clicks per 1,000 tracked views, using the same 32px kernel. Kernel density is a smoothed value, not an element CTR. Zero-view cohorts do not divide by zero. Registered-element comparison uses distinct exposed and activated views. Pixels from unrelated layouts are never subtracted. Single-page maps retain their explicit relative-log-density mode.
- Scroll reach and qualified viewport exposure do not establish reading, gaze or attention. Repeated/dead-click signals are heuristics. Sampled performance/errors are diagnostic guardrails with their own measurement counts, not an assertion of whole-population safety.

Primary methodology references: [heatmap.js rendering API](https://www.patrick-wied.at/static/heatmapjs/docs.html), [NN/g on F-pattern limits](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/?swcfpc=1), [Microsoft on SRM](https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/), [Microsoft on experiment monitoring](https://www.microsoft.com/en-us/research/articles/patterns-of-trustworthy-experimentation-during-experiment-stage/).

## Persistence, security and deployment limits

Migration 005 is additive and keeps existing raw events, references, source classifications, credentials and policies. New view dimensions are server-owned snapshots; historical views without them remain unknown, rather than being rewritten with today's market metadata. Active tests lock page policy/metadata changes. Reducing retention below an active attribution window is rejected. Backend keys/unit hashes, experiment lifecycle and outcomes belong to private retained storage; audit records omit secrets and unit tokens. Backups/restore include all new tables and reference bytes. Protect backups as sensitive application data; production encryption/access/expiry remain deployment work.

Reports enforce explicit budgets (50,000 ledger visits per selected interval, 200 experiments in the list, existing page/event/reference budgets). They fail explicitly when exceeded. This is not evidence of production throughput. Independent PostgreSQL/service roles, real consent adapters, HTTPS, company authentication, sandboxed external capture, backend/ad-cost connections, wider-browser coverage and load/recovery qualification remain release gates in `PRODUCTION_READINESS.md`. No ad account, CRM or customer backend has been connected in this workstation build.
