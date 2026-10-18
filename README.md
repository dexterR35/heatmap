# Heatlens by Graphoria

Landing-page link and pixel verification is available in **Landing pages**, **Markets**, and **Installation**. A saved registry row is a draft, not proof of an installed pixel. See [link, pixel, delivery and timezone checks](docs/INSTALLATION_CHECKS.md).

A working, private, local-first heatmap monorepo for **selected landing pages**. Its 16 workspace projects include a custom tracking SDK, validated collector, private API, durable worker, isolated capture runner, persistent PostgreSQL-compatible storage, Canvas renderer, and React dashboard. It does not wrap another analytics product. See [the complete structure and data flow](docs/ARCHITECTURE.md).

**Release: local synthetic demo. Real-site collection is deliberately disabled.** The supplied NetBet URL is a disabled draft, not a verified installation. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for the difference between this build and the full v1.2 production specification.

The local fixture records actual browser clicks after consent. Dashboard reports default to **Recorded activity**. Generated examples and earlier mixed data are separate sources; neither inflates the recorded metrics. See [the local click verification steps](docs/OPERATIONS.md#seeing-your-actual-local-clicks).

The analytics upgrade adds campaign comparisons, ordered CTA funnels, responsive element heatmaps, page revisions, privacy-controlled diagnostics, delivery reporting, scheduled maintenance and OpenTelemetry metrics. See [the analytics guide](docs/ANALYTICS_UPGRADE.md).

**0.4.0 acquisition & experimentation:** market/product/brand scope, transactional registry import and export, site-scoped backend acquisition integration, deduplicated registration/qualified-acquisition outcomes, reconciled daily spend, A/A and A/B experiments, fixed-horizon validity checks, frozen final readouts, consent withdrawal and shared-scale heatmap comparisons. See [the acquisition and experiments guide](docs/ACQUISITION_EXPERIMENTS.md). The supplied UK Casino URL is a disabled registry draft; its page content was not accessible for inspection. No real-site installation is implied.

## Run on this workstation

Node 24 LTS is the container baseline. Native development also supports the installed Node 26.11.1. pnpm is pinned in `package.json`.

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm admin bootstrap-local
pnpm start
```

Open **http://127.0.0.1:3000**. The bootstrap command generates a unique random local password in `.local/admin-credentials.json`; it does not print it or overwrite an existing account. Open that ignored file locally to sign in. For a personally chosen administrator instead, use `pnpm admin create-user` in an interactive terminal before starting the server. Its password entry is hidden.

The optional `pnpm seed` command inserts 210 synthetic views, split between two separate campaign selectors on the same path. Re-running it preserves existing policies and does not duplicate the fixture. Native mode persists a real PGlite database under `.local/database`; it requires no Docker or remote service. Only one native process may open that directory at a time. Stop the server before running offline administration, seeding, retention, backup, or restore commands.

With the server running, capture its real local layouts:

```powershell
pnpm exec playwright install chromium
pnpm capture
```

The capture runner renders Halloween and Christmas at 1440×900 and 390×844, producing four reference images and manifests. Only these deterministic synthetic fixtures are auto-approved. Manual screenshot imports stay pending until reviewed. Reload References or Heatmaps after capture.

You can now also use **References → Capture selected page** directly in the dashboard. Choose its width, wait for the screenshot, review the full image, approve it, and click **Use this layout**. Captures initiated from the UI stay pending review. The Heatmaps screenshot selector keeps an explicit approved reference selected while you analyze its compatible cohort.

| Address | Purpose |
| --- | --- |
| `http://127.0.0.1:3000` | Authenticated dashboard and management API |
| `http://127.0.0.1:8080` | Collector: immutable SDK, public config, event ingestion, health |
| `http://127.0.0.1:4173/casino/?lp=halloween` | Consented local Halloween fixture |
| `http://127.0.0.1:4173/casino/?lp=christmas` | Separate Christmas fixture |

Use `pnpm dev` to build and start in one command. It is a retained local server, not a hot-reloading Vite development session. After editing source, rebuild and restart.

If startup reports `EADDRINUSE` on port 4173, another application is using the demo port. Set both values in your local `.env` to an available port, then run `npm run start` (or `pnpm start`) again:

```dotenv
DEMO_PORT=4174
DEMO_ORIGIN=http://127.0.0.1:4174
```

The dashboard stays at `http://127.0.0.1:3000`. Startup updates the saved demo site and page selectors to the configured origin while preserving recorded data and page policies.

Interactive Recharts v3 charts now cover campaigns, funnels, diagnostics, comparisons, heatmap quality and operations, with darker, more readable text. See [chart controls and data definitions](docs/CHARTS.md).

## What is connected

- **SDK:** page views, pointer coordinates, keyboard/host actions, geometry segments, cumulative scroll reach, visible time, and qualified element exposure; memory-only identities and bounded retries.
- **Event API:** exact Origin checks, explicit CORS preflight, strict schema validation, 32 KiB body limits, transient source limits, site/day and view quotas, immutable view context, event-ID conflict detection, and commit-before-204 behavior.
- **Database:** site/page registry, approved static URL selectors, view timestamps/context, event coordinates and viewport geometry, durable jobs, facts, references, sessions, roles, site membership, privacy policy, and audit records. Raw visitor URLs are never collected.
- **References:** actual screenshots plus validated layout manifests, metadata stripping, private-region masking, SHA-256 checksums, approval, and exact-width/document-height compatibility.
- **Dashboard:** page/date/device/viewport filters; click, scroll-reach, and registered-element overlays; page comparisons; mapped/excluded coverage; aggregate CSV and annotated PNG exports.
- **Element reporting:** repeated clicks, distinct exposed/activated views, and exposed-view activation intersections stay within the selected device/viewport, including views that resize.
- **Privacy:** consent and anonymous-public-context gates, ignored/private regions, no form values or tracking cookies, global and page stops, retention, and a minimum real-data reporting threshold.
- **Marketing handoff:** generated selected-page script, immutable SDK/SRI, consent/context bridge examples, exact inclusions/exclusions, CSP instructions, verification and rollback runbooks.

## Validate

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm release:check
pnpm run doctor
pnpm test:e2e  # disposable services/database; keeps your recorded data untouched
```

Vitest uses isolated databases. Browser tests collect only from loopback synthetic pages. Screenshots are written to `.local/evidence`. No command contacts a real NetBet landing page.

## PostgreSQL / Docker alternative

Docker is optional and was unavailable on the implementation workstation. The supplied Compose path is **not execution-verified** here:

```powershell
Copy-Item .env.example .env
docker compose --profile tools run --rm bootstrap
docker compose build
docker compose up -d db
docker compose run --rm app pnpm admin bootstrap-local
docker compose run --rm app pnpm seed
docker compose up -d app
docker compose exec app cat /app/.local/admin-credentials.json
```

All host-published ports bind to `127.0.0.1`. PostgreSQL has no published port. `docker compose down` preserves named volumes; do not add `-v` unless you deliberately intend to discard them. The application and tools share one local database account in this demo profile. Separate least-privilege service roles and service/container isolation are production work, not implemented security claims.

Native capture may connect to the Compose dashboard using `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables rather than the host credential file. Never place passwords in command-line arguments.

## Handoff

- [Marketing installation guide](docs/MARKETING_INSTALL.md)
- [Workspace structure and service architecture](docs/ARCHITECTURE.md)
- [Consent integration](docs/CONSENT_INTEGRATION.md)
- [Operations, retention, backup and recovery](docs/OPERATIONS.md)
- [Threat model and limits](docs/THREAT_MODEL.md)
- [Security audit, fixes and production link limits](docs/SECURITY_AUDIT.md)
- [Implementation status and verification evidence](docs/IMPLEMENTATION_STATUS.md)
- [Production release gates](docs/PRODUCTION_READINESS.md)
- [Dependency inventory and primary documentation](docs/DEPENDENCIES.md)
- [Original supplied build specification](docs/NETBET_HEATMAP_BUILD_SPEC.md)
