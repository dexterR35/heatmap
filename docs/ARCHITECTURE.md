# Aggregate heatmap architecture

This is a private pnpm monorepo with 16 workspace projects including the root toolchain. It implements aggregate behavior reports and separately reviewed reference screenshots. Visitor-session replay and DOM recording are excluded. The heatmap SDK keeps memory-only identities. The separate 0.4.0 acquisition ledger accepts a host-owned, random site-scoped unit token after consent, stores only its site-scoped hash, and retains it under the raw-data policy. It never links a unit across sites. See [the integration contract](ACQUISITION_EXPERIMENTS.md).

```text
trackinglandingpages/
  apps/
    dashboard/       React UI: pages, maps, references, install, quality, privacy
    tracker/         Consent-gated loader and immutable browser SDK
    collector/       Independent ingestion service entry point
    api/             Independent private management/UI service entry point
    worker/          Independent worker, durable leases and aggregation
    capture-runner/  Isolated loopback-only Playwright process
    demo/            Independent synthetic landing-page server
    server/          Shared HTTP factories and native local orchestrator
  packages/
    contracts/       Strict event JSON Schema and TypeScript types
    domain/          Exact-page matching, geometry and view/segment facts
    heatmap-renderer/ Custom Canvas density renderer
    db/              PostgreSQL/PGlite adapter and additive SQL migrations
    config/          Environment and local binding policy
    security/        Argon2id, sessions, CSRF helpers, limits and audit
    storage/         Private reference storage interface and filesystem adapter
  scripts/           Build, migration, admin, seed, capture, maintenance
  tests/             Contracts, ingestion, report cohorts, capture, recovery, browser
  config/            Disabled real-page example and scope fixtures
  infra/             Local Docker packaging
  docs/              Installation, contracts, operations and release evidence
```

## Native local mode

`pnpm start` launches the private dashboard/API on port 3000, collector on 8080, demo on 4173, and worker in one Node process. Each HTTP application has its own route set. This mode uses a single persistent PGlite owner because its filesystem database must not be opened concurrently by separate processes.

The capture browser is always a separate child process. It receives a selected fixture, viewport and staging directory, plus a minimal environment. It receives no database connection or administrator credentials. The trusted parent validates and imports its image/manifest and leaves it pending review.

## Independent service entry points

For a shared PostgreSQL database, the actual entry points are:

```text
pnpm db:migrate        # privileged setup; schema + idempotent disabled registry seed
pnpm start:api        # private dashboard and management routes
pnpm start:collector  # SDK/config/events/health allowlist
pnpm start:worker     # bounded durable job processor
pnpm start:demo       # local public-page fixtures
```

Run each service from its own terminal with the appropriate `DATABASE_URL`. Collector/API/worker reject standalone startup without it; they cannot accidentally race on the embedded database. Native `pnpm start` remains the simplest supported workstation mode.

Separate entry points are implemented; independent PostgreSQL deployment and least-privilege role grants remain execution-unverified here because Docker/PostgreSQL are unavailable on this workstation. The supplied Compose file remains the combined local profile. The default does not expose any management or database port beyond loopback. Corporate authentication, public collection infrastructure, hardened capture of untrusted websites, and production role approval remain release gates.

## Collection and processing

1. The host-owned bridge matches the exact selected URL locally. Unknown queries, duplicate selectors and unselected campaigns exit without collector requests.
2. Explicit analytics consent and an eligible public context allow immutable SDK loading and bounded remote configuration.
3. The SDK sends schema-limited, memory-only view events. Capture and transport each recheck permission.
4. Ingestion validates origin, policy, context, geometry, timestamps and quotas. One transaction persists the view/event receipt and durable job. `204` follows that commit.
5. A worker persists its lease/attempt before calculation. It computes view facts from retained evidence and verifies ownership before committing facts and completion together. Failed work backs off and enters a visible failed state after five attempts. Expired leases can be recovered.
6. Reports require confirmed page views and aggregation v2. Viewport segments keep their own clicks/actions/exposure so a resized view cannot leak a mobile CTA into desktop metrics.

## Capture → review → map

In References, choose a viewport and click **Capture selected page**. The API persists a capture job, enforces one concurrent capture, and starts the isolated fixture runner. UI polling reports queued/running/failure states. Successful images stay pending review.

Review the full image, approve it, and click **Use this layout**. Heatmaps can also explicitly select any compatible approved screenshot from history. Matching requires the same site/page, revision, locale, variant, presentation state, exact viewport width and compatible document height. Broad width/device filters provide counts without projecting points onto a guessed layout.

Automatic capture is restricted to the two known local fixtures. Real-page drafts use reviewed manual PNG/WebP and manifest imports. A failed capture produces an explicit error, never a fabricated screenshot.

Reports return grouped click cells, compatible scroll-reach segment counts, element engagement, denominators and coverage exclusions. The element table distinguishes repeated pointer clicks, distinct exposed views, distinct activated views, and the intersection used for exposed-view activation rate. Exports remain aggregate.

## Migration and retention

Migration 002 adds capture jobs and schedules older derived facts for recomputation. Site keys, page identities, event IDs, approvals, users and existing references are preserved. Fact aggregation v2 is built from existing retained events.

Reference storage keys are generated UUIDs and are validated independently of filesystem paths. The SQL registry stays private; image reads require a scoped authenticated API request. Backups include capture metadata and reference bytes; restore requires an empty target. Maintenance skips unprocessed views, prunes completed capture history by policy, and removes expired references without invalidating retained page identity.

## Analytics and operational upgrade

Migration 004 adds per-page campaign/diagnostic/primary CTA policy, operation runs and alerts. Aggregation v3 rebuilds retained facts once, preserving source classification and immutable events. `packages/domain/advanced.ts` derives ordered journeys, bounded diagnostics and per-view performance/delivery maxima. `apps/server/campaigns.ts` applies membership and privacy suppression before portfolio totals. Document/element mapping and both version reports retain independent geometry/cohorts.

`operations.ts` owns the minute scheduler and durable cross-replica claims. `backup-service.ts` creates and verifies consistent logical snapshots plus registered reference bytes. `telemetry.ts` exports optional OTLP service metrics without visitor attributes. See [ANALYTICS_UPGRADE.md](ANALYTICS_UPGRADE.md) for definitions and deployment boundaries.

## Acquisition and randomized experiments

Migration 005 adds page/market metadata, immutable server-owned view dimensions, backend integration key hashes, experiments, assigned acquisition visits, outcomes and daily spend. The collector exposes backend-only `/v1/acquisition/*` routes; they reject browser Origin headers and require a revocable site-scoped key. Real-property collection is rejected independently of registry flags. The native demo alone exposes an origin-checked synthetic experiment lab.

The host obtains an assignment before rendering, confirms the actual variant and supplies `acquisitionId` to the consent-gated SDK bridge. Non-base variant events require the matching recorded assignment and rendered context. Assignment counts and completed outcomes use the full acquisition ledger, independent of heatmap sampling. Approved reference manifests retain their exact variant identity. Experiment heatmaps filter on the linked assignment, and comparisons normalize both maps to one shared linear density scale.

Lifecycle/assignment/outcome/freeze operations serialize on the site row. Variant codes cannot be reused within a page revision. Final readouts can be frozen only after the fixed-horizon validity checks pass; their aggregate snapshot survives raw retention. Privacy withdrawal deletes the unit's acquisition visits/outcomes and linked raw heatmap evidence across that site. Unfrozen experiments with privacy exclusions or pruned evidence cannot publish a conclusive readout. Backups/restores include every new table; browser tests use disposable storage.
