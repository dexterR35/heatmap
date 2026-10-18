# Implementation status — 2026-10-17

## Acquisition and experimentation · 0.4.0

Implemented the local market/product/brand registry, atomic JSON import/dry-run/export, acquisition backend integration, site-scoped revocable keys, stable experiment assignments, confirmed rendered variants, deduplicated registration/qualified-acquisition outcomes, daily spend reconciliation, A/A and A/B lifecycle, fixed-horizon power planning/readouts, SRM/rendering/maturity/retention/privacy validity checks, frozen aggregate results, sampled experience guardrails and shared-scale experiment/page heatmaps. Variant references can be captured on the fixed local fixtures and must be reviewed. Native mode includes a consented assignment → rendered page → actual SDK clicks → explicit demo outcome → withdrawal lab. The host adapter and full definitions are in [ACQUISITION_EXPERIMENTS.md](ACQUISITION_EXPERIMENTS.md).

The supplied UK Casino landing page was added as a disabled draft. Actual UK content/CMP/redirect behavior was not accessible (HTTP 403); no real NetBet integration or collection was enabled. A single **Local A/A · acquisition validation** draft is ready in the workstation. No generated acquisition outcomes were added to its recorded dataset.

Final verification: strict typecheck and production build pass; **123 checks across 19 unit/integration files and all 23 Chromium browser journeys pass**. The new journeys exercise atomic registry review/scope, real browser assignment, correct variant capture/reference mapping, duplicate callback handling, inconclusive immature results, responsive screens and actual consent withdrawal with linked evidence deletion. Login-intensive new journeys use a disposable authenticated fixture; the real login limiter remains unchanged. A pre-existing timestamp-boundary test now uses explicitly distinct fixture times, avoiding an assumption that two requests consume separate milliseconds. Twelve local link/auth/CORS/integrity checks and the local release check pass. The SDK is **5,910 bytes gzip**.

The workstation was physically backed up before migration, then logically backed up with checksum/read-back verification after migration. Existing source totals and all **9 registered references** were preserved. Actual recorded activity remains **2 views, 42 clicks and 42 mapped observations** at 1559px, with no incompatible/unsupported observations. Acquisition reports contain no recorded customer outcomes. Desktop checks covered Markets, Acquisition, Experiments and shared comparisons; 375px checks covered the three new screens. No document overflow or browser errors were observed. Evidence: ignored `.local/evidence/growth-upgrade-preservation.json`, `live-growth-check.json`, `live-growth-*.png` and the disposable browser evidence `growth-*.png`.

The final native server is running on loopback ports 3000/8080/4173. Full production deployment, actual host consent/identity/outcome adapters, ad-spend connections, wider-browser qualification, independent PostgreSQL/service-role operation and measured load/recovery remain unverified release work. No independent security certification or guaranteed conversion lift is claimed.

**0.3.0 analytics upgrade:** campaign portfolio, ordered CTA funnels, Wilson intervals, engagement/time-to-action, responsive element mapping, version comparisons, bounded private diagnostics, data-quality delivery/lag reporting, rule-based investigations, scheduled retention/verified backups, persistent alerts and optional OpenTelemetry metrics are implemented. See [ANALYTICS_UPGRADE.md](ANALYTICS_UPGRADE.md) for definitions, setup and remaining deployment gates. Earlier checkpoint counts below are historical.

**Full local aggregate-heatmap workspace implemented and exercised. Production/staging integration is not approved. Visitor-session replay remains excluded.**

The user requested a tracking SDK, secure event API, persistent database, aligned page snapshots, filtered dashboard, privacy controls, and Marketing installation instructions. The attachment was used as the design/reference specification; its production kickoff/release instructions are not evidence of live-site authorization.

## Delivered

| Capability | Implementation / evidence |
| --- | --- |
| Selected landing pages | `packages/domain/matcher.ts`; exact-origin/path/rendering-query identities; malformed/duplicate/unknown query rejection; ambiguity fails closed; independent same-path seasonal fixtures |
| Tracking SDK | `apps/tracker/`; consent/context-gated immutable IIFE; generated SHA-384 SRI; memory-only view and segment IDs; clicks/taps, semantic actions, scroll, exposure, viewport geometry, bounded queue and retry |
| Secure collector | `apps/server/collector.ts` and `ingestion.ts`; explicit CORS, strict shared TypeBox/Ajv contract, limits, quotas, event hashes, immutable context, durable transaction and jobs |
| Database | `packages/db/`; persistent PGlite native mode tested, same SQL contract via `pg` for PostgreSQL mode; initial migration, per-site/page keys, sessions, reference registry, audit and policy |
| Processor | Durable view jobs, expired-lease recovery, atomic idempotent view facts, cumulative maxima, orphan-view suppression, view-level activation denominators |
| Snapshots | Separate local-only Playwright process; four actual captures at desktop/mobile geometry; private-region masking; validated/re-encoded manual import; review/approval; authenticated private bytes |
| Heatmaps/dashboard | React/Vite UI; page/date/device/exact-width filters; custom Canvas density kernel; scroll/element overlays; isolated page comparisons; reference library; coverage; CSV and annotated PNG |
| Privacy/auth | Consent and eligibility teardown; no tracking cookies/storage; forms/private regions excluded; Argon2id administrator; hashed opaque sessions; CSRF/Host/Origin checks; role/membership enforcement; retention and kill switches |
| Marketing | Page-scoped bridge, real built artifact/SRI, exact scope preview, CSP and consent/context examples, verification steps and rollback; real install export visibly blocked |
| Operations | Native diagnostics, seed, reference capture/import, scheduled and offline retention, verified logical backup and empty-database restore; pinned Docker/Compose files and CI workflow supplied |

## Commands actually run

- `pnpm install --frozen-lockfile` — succeeded after enabling only esbuild's declared build hook.
- `pnpm typecheck` — succeeded.
- `pnpm test` — 58 checks passed across 8 files, including a persistent reopen and logical backup/restore roundtrip with reference checksum verification.
- `pnpm build` — succeeded; SDK measured approximately **4.4 KiB gzip**, below the 35 KiB target. Consult `dist/sdk/artifact.json` for the current exact size/hash.
- `pnpm admin bootstrap-local` — unique randomly generated local administrator; secret stored in ignored `.local/admin-credentials.json` and not printed.
- `pnpm seed` — 210 persisted synthetic views; real NetBet candidate remained disabled.
- `pnpm start` — dashboard, collector and demo bound to loopback.
- `pnpm exec playwright install chromium` — installed the browser matching the pinned Playwright package.
- `pnpm capture` — four approved synthetic references imported. An initial footer geometry mismatch was fixed and capture re-run successfully.
- `pnpm test:e2e` — 11 Chromium browser checks passed: authentication, Canvas pixels, desktop/mobile geometry, dialog scope preview, no pre-consent network, unselected campaigns, withdrawal, query-only invalidation, private regions, keyboard activation without fake coordinates, and unauthenticated API rejection. The added keyboard check caught a zero-size private-region edge case; the SDK was corrected and rechecked.
- `pnpm run doctor` and `pnpm release:check` — local diagnostics and explicit local-release checks succeeded. Production gates remain unverified.
- `pnpm audit --prod --json` — zero reported known advisories at this checkpoint.

Browser evidence is under `.local/evidence/landing-pages.png`, `heatmap-desktop.png`, and `heatmap-mobile.png`. These contain synthetic data. Reference source artifacts are under `.local/staging`; approved private images are in `.local/references`.

## Intentional local-build choices and outstanding specification work

- Docker was not installed. PostgreSQL container execution and migrations against a real PostgreSQL 18 instance are **NOT_RUN**. Native filesystem PGlite persistence and the SQL ingestion path were exercised.
- This is a strict TypeScript monorepo with 16 workspace projects. Native PGlite mode keeps one local orchestrator; independent API, collector, worker and demo entry points are available for PostgreSQL. The capture browser is a separate process. Least-privilege database role deployment remains pending.
- External capture, real collection and public deployment are disabled. The supplied NetBet campaign content, redirect behavior, internal framework/CMP and production access remain UNKNOWN. No real hostname was used to generate events or screenshots.
- Advanced brand/domain-group/family management, transactional registry import dry-runs, page/campaign groups, configuration migration from old live installs, user-management screens, and arbitrary approved release editing remain future work.
- The element overlay displays registered geometry and qualified exposure. Fixed-layer references, a renderer web worker and shared comparison heatmap scale are not implemented.
- Date reports are UTC-boundary filters over retained facts; no durable long-term aggregate archive or arbitrary-time historical reconstruction is claimed.
- Failed worker attempts now persist, back off and enter a failed state after five tries. Shared multi-replica edge controls, production role grants, OIDC/MFA, partition management, production-approved deletion/backup schedules, and a measured load envelope remain pending.
- No broad live rollout, independent penetration test, accessibility audit, Safari/Firefox coverage or production restore exercise has been performed. A targeted local source/security test pass is documented in `SECURITY_AUDIT.md`.

See `PRODUCTION_READINESS.md` for explicit gates before expanding beyond the local demo.

## Aggregate workflow and structure upgrade

- Added real pnpm workspaces for API, collector, worker, capture runner, dashboard, SDK, demo and shared packages. The native start command preserves the existing local database and credentials.
- Added additive SQL migration 002 for durable capture jobs and aggregation-v2 rebuilding. Existing raw events, identities, policies and references are preserved.
- References can capture a selected local page and viewport from the UI, show an explicit job failure, hold the resulting image for review, and use a chosen approved layout in Heatmaps.
- Reference selection validates page/revision/locale/variant/state/exact width. Broad width filters show counts without guessing an overlay.
- Fixed device-cohort leakage for resized views and populated real per-element click, exposure, activation and exposed-activation metrics.
- Added a private filesystem storage interface, capture-aware retention/backup, and durable worker retry/dead-letter behavior with lease-ownership checks.
- Verification checkpoint: **66 automated checks and 13 Chromium browser checks pass**, including the new capture → review → approval → map flow and element reporting. Type checking and the production asset build pass. Independent PostgreSQL deployment remains NOT_RUN.

## Security and link audit checkpoint · 2026-10-16

- Fixed inherited query-name allowlist bypass, idle-session login recovery, signed/expiring pre-login CSRF, strict query/selector/date validation, private-image authorization order, upload decoding/resource checks and hidden-path fallback responses.
- Removed the constant HTML sink in the synthetic fixture, escaped script-context JSON and validated collector/artifact settings before script loading. The dashboard's demo link now follows the configured origin.
- `pnpm test`: **80 tests passed across 11 files**. `pnpm test:e2e`: **14 Chromium checks passed**, including literal rendering of image/SVG/script/JavaScript-link XSS probes and rejected unsafe URL schemes.
- `pnpm verify:links`: **12 checks passed** for local documents, authenticated routes, CORS, exact selector scope, immutable SDK/SRI, private PNG and blocked real installs. Timestamped results: `.local/evidence/link-check.json`.
- `pnpm typecheck`, `pnpm build`, `pnpm release:check`: passed. SDK: **4,563 bytes gzip** at this checkpoint; consult the generated artifact for its current hash.
- Both production-only and full dependency audits reported **zero known advisories**. Source search found no executable HTML/eval sink in the dashboard, server or tracker application code.
- `SECURITY_AUDIT.md` records findings, fixes, test scope and residual production blockers. Production DNS/TLS/redirects/CMP, independent PostgreSQL service deployment and public release remain **NOT_VERIFIED**.

## Deeper security review and recorded activity · 2026-10-16

- Reproduced and fixed encoded-route logout CSRF, insufficient reference role/review checks, cross-view event receipt reuse and an exhausted worker lease that could remain processing. Added dynamic privacy rechecks for qualified exposure.
- Added migration 003 with server-owned `recorded`, `seeded` and `legacy` view provenance. Existing mixed rows remain intact as legacy. Fresh SDK activity is recorded; generated seed events are separately classified. Default heatmaps, comparisons and CSV exports exclude generated and legacy rows.
- The user identified the local Halloween fixture as the page they tested. Its global stop was enabled; collection was resumed at their request. The test page now displays whether analytics is awaiting consent, connecting, active at a specific viewport width, or paused.
- The dashboard defaults to Recorded activity, refreshes heatmaps every three seconds, offers observed viewport widths and uses a matching observed width automatically until the user chooses a filter. References can capture a nonstandard observed width within the local capture limit.
- Browser checks now run against disposable storage, random loopback ports and separate generated credentials. The end-to-end recording check creates actual browser clicks, checks the visible click count and nonempty heatmap pixels, and leaves no test events in the user's database.
- Verification: **88 automated tests / 12 files**, **19 Chromium checks**, **12 local link checks**, type checking, build and release check pass. SDK: **4,583 bytes gzip**. Screenshot: `.local/evidence/recorded-clicks-verified.png` (isolated acceptance fixture).
- Follow-through on the user's actual local test: the running collector received **42 new clicks across 2 views at 1559px**. Captured that exact fixture width, visually reviewed/approved the screenshot, and verified **all 42 clicks mapped, 0 incompatible, 0 unsupported**, with nonempty heatmap pixels in the dashboard. Evidence: `.local/evidence/user-recorded-heatmap.png` and `user-recorded-heatmap-check.json`. These counts are a point-in-time check of recorded traffic and are separate from generated/legacy totals.

## Analytics upgrade verification · 2026-10-17

- Version 0.3.0: frozen install, strict typecheck and production asset build succeeded. SDK: **5,860 bytes gzip** with regenerated immutable hash/SRI.
- **103 unit/integration checks across 15 files passed**, including current backup/restore, policy RBAC, campaign scope, funnel order, masks, visual-offset exclusions, operational claim recovery and a real loopback OTLP export.
- **20 Chromium browser checks passed**. A final focused rerun also passed both new dashboard/diagnostic checks after the final filtering/geometry fixes. Mobile navigation now keeps accessible names when labels are visually hidden.
- Production and full dependency audits reported **zero known advisories**. Local link/SRI/CORS/auth checks passed. No independent penetration test or production infrastructure scan is implied.
- Live workstation verification preserved **2 recorded views and 42 clicks**, with **42/42 mapped** to the 1559px approved reference. Migration retained source classifications and rebuilt facts to v3. The resulting ordered funnel is 2 views → 2 exposed views → 1 later CTA activation; it is not a completed-registration count.
- Created and read-back-verified an actual local backup containing all eight registered reference images. The local backup remains unencrypted; automatic backup stays off until configured in Operations.
- Actual workstation screenshots and machine-readable checks: ignored .local/evidence/live-campaign-analytics.png, live-conversion-funnels.png, live-experience-diagnostics.png, live-recorded-heatmap.png, live-analytics-operations.png, live-campaign-analytics-mobile.png and analytics-upgrade-live-check.json. Browser fixture tests use separate disposable databases.

The local server was restarted and left running on ports 3000, 8080 and 4173. Refresh dashboard/landing tabs to load new assets; new performance/error diagnostics need new consented visits.

## Charts and readability checkpoint · 2026-10-17

Added Recharts 3.10.1 with React-matched react-is 19.3.1, lazy chart loading and shared dark text tokens. Interactive campaign, funnel, diagnostic, heatmap-quality, comparison/version and operational charts use filtered real report projections; calendar gaps, unavailable performance and privacy suppression remain explicit. The final scope follows the user's choice of v3.

Frozen install, typecheck/build, 108 checks across 16 files, all 20 Chromium checks, focused final chart checks, both dependency audits and local link/integrity checks passed. Actual workstation chart totals still match 2 recorded views and 42 clicks; page/legend selection, mobile overflow and browser errors were checked. The local server remains running. See [CHARTS.md](CHARTS.md) for controls, definitions and validation limits.

## Dark theme checkpoint · 2026-10-17

Added default dark workspace and login surfaces, bright readable text, light/dark preference control and vivid theme-aware Recharts colors. Theme storage is confined to an appearance preference in the management UI; tracker behavior/data are unchanged. Build/typecheck and 21 Chromium checks passed. The actual local workspace still has two recorded views and 42 clicks. Scoped text contrast checks passed on ten main dark screens, with no mobile overflow or browser errors. The server remains running.

## White workspace redesign · 2026-10-17

The user's latest white-only direction supersedes the dark-theme checkpoint. Removed the theme toggle and dark styles, reset older saved dark preferences, and introduced a white/warm-neutral workspace with stronger black text, orange brand accents and distinct chart colors. Graphoria provided the visual reference; Vercel's interface guidelines informed spacing, hierarchy, focus and disclosure.

The campaign Overview now presents three metrics, one trend chart and a shorter table. Device/CTA/experience comparisons, detailed metrics, heatmap element reporting and quality detail are opened on demand. Navigation has four primary destinations plus Analysis/Manage groups. Mobile menus retain labels and support selection, outside-click and Escape dismissal; hash navigation handles browser back/forward. Suppressed reports have explicit empty states and unavailable headline values.

The redesign changes presentation and navigation only. Consented recorded activity, separate sample data, privacy suppression, reference geometry, SDK size and the local-only production gate remain intact. Verification and current chart controls are documented in [CHARTS.md](CHARTS.md).

Final verification: typecheck and build pass, **108 unit/integration tests and 21 Chromium tests pass**. Solid-background HTML text checks pass across all 12 main routes and the 375px Overview; no horizontal document overflow or browser warnings/errors were observed in the final checks. This is scoped UI verification, not a full accessibility audit. The live heatmap retains **2 recorded views, 42 clicks, 42 mapped observations and 0 incompatible/unsupported observations** at 1559px. Evidence: ignored `.local/evidence/white-workspace-overview.png`, `white-workspace-mobile.png` and `white-workspace-check.json`. The local server was restarted with the final assets and left running.

## Dashboard branding and TanStack tables · 2026-10-17

Applied the user's revised direction: the original Graphoria logo alone, a white canvas with no cream grid, a charcoal sidebar, Inter for every dashboard label and heading, and restrained orange accents. Original logo/Inter assets are self-hosted. The condensed display face and affiliation byline were removed.

Added TanStack Table 9.3.1 across registry, campaign, element, chart-data, audit and maintenance tables. Shared sorting and pagination apply to complete API datasets. Growing histories use new owner-only paginated endpoints with exact counts, snapshot boundaries, unique sort tie-breakers, strict query validation and bound SQL values. Requests discard superseded responses; filters and page-size changes reset pages. [TABLES.md](TABLES.md) records API parameters, client/server boundaries and validation limits.

Typecheck/build, **113 tests across 17 unit/integration files**, and **21 Chromium checks** pass. The browser scenario covers real API history paging and isolated registry pagination/search. The production dependency audit reports no known advisories. These checks do not establish absence of all vulnerabilities or certify a production deployment. Workstation activity remains separate from the disposable browser fixtures.

Live verification also checked two actual audit-history pages: 1–5 and 6–10 of 88 records, with ten distinct row IDs. The live heatmap still shows 2 recorded views, 42 clicks and 42 mapped observations. Administrative storage totals explicitly cover all stored sources, and their refresh now reloads the relevant APIs. Final solid-background text checks passed on all 12 routes; desktop/mobile captures are `.local/evidence/dashboard-tanstack-desktop.png` and `dashboard-tanstack-mobile.png`, with results in `dashboard-tanstack-check.json`. The final CSS background adjustment was built and visually/computed-style checked. The server remains running on ports 3000/8080/4173.
