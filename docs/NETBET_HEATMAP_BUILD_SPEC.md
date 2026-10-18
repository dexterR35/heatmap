# NetBet Heatmap Studio
## Full custom-build specification for Codex

**Document version:** 1.2.0  
**Prepared:** 2026-10-16  
**Target:** An internally owned, local-first heatmap platform for individually selected campaign landing pages across approved domains  
**Primary example:** `https://go.netbet.ro/casino/?lp=halloween`  
**Scope:** Exact origin + exact path + approved page-selecting query values; multiple landing pages and domains are supported. Parent websites and whole-site tracking are NOT required and are NOT enabled by default.  
**Status:** Implementation specification. No application has been built, deployed, security-audited, or approved for live collection by this document.

> Build the analytics product itself: the browser tracker, event collector, processing pipeline, database, private dashboard, screenshot workflow, and heatmap renderer. Do not wrap Clarity, Hotjar, Matomo, PostHog, or another analytics product. Do not use heatmap.js or rrweb. Ordinary frameworks, database drivers, test tools, security libraries, and browser APIs are allowed. Do not invent cryptographic primitives or password hashing.

> The first deliverable must run locally with synthetic traffic and local test pages, without a purchased domain, paid analytics service, production website access, or runtime AI API. Live collection is a separate, gated deployment capability.

> Version 1.2.0 corrects the previous over-broad framing. The primary object is a SELECTED LANDING PAGE, not an entire website. For example, `/casino/?lp=halloween` is one target; `/casino/?lp=christmas`, `/casino/`, and a parent homepage are not implicitly included. Keep multi-domain capability, but do not require a 15-site rollout. Only selected pages receive instrumentation. A separately requested wider public-site scope is optional, explicit, and off by default.

---

## Contents

1. Product outcome and boundaries
2. Facts, assumptions, and NetBet onboarding
3. Architecture and operating modes
4. Technology decisions
5. Repository layout and engineering rules
6. Local installation and developer experience
7. Domain registry and page configuration
8. Privacy, consent, and collection eligibility
9. Tracker public API and installation
10. Tracker lifecycle, navigation, and sampling
11. Event schema and transport contract
12. Accurate click coordinates and layout compatibility
13. Scroll, exposure, and CTA definitions
14. Custom heatmap rendering
15. Reference screenshots and layout manifests
16. Collector API and abuse controls
17. Database schema and durable ingestion
18. Processing, rollups, and analytical correctness
19. Private dashboard and management API
20. Authentication and authorization
21. Marketing installation runbook
22. Local-to-public collection without buying a domain
23. Production deployment and migration
24. Retention, deletion, backup, and recovery
25. Security model and threat register
26. Performance and capacity planning
27. Observability, support, and incident runbooks
28. Testing and acceptance matrix
29. CI, supply chain, and release management
30. Codex implementation milestones
31. Production release gates
32. Future extensions and explicit non-goals
33. Environment variable contract
34. Configuration examples
35. Reference database DDL
36. API examples and error contract
37. Acceptance scenarios and metric test vectors
38. Codex kickoff prompt
39. Project-owner handoff checklist
40. Sources and verification notes

---

## 1. Product outcome and boundaries

### 1.1 What the owner should receive

A working monorepo that starts a private dashboard, management API, public-ingestion service, worker, PostgreSQL database, screenshot storage, and demo landing pages through Docker Compose. The owner can paste a landing-page URL, register only its necessary origin and exact path/query selector, approve that page, generate a page-scoped installation snippet, receive consented events, capture a safe reference image, and inspect click density, scroll reach, section exposure, and CTA activation.

The dashboard must support multiple brands/domain groups, markets, site families, exact-origin properties, and selected landing pages from its first release. Lead with a Landing Pages list and an Add landing page URL workflow; the origin registry is supporting configuration, not a requirement to instrument parent sites. One dashboard and backend serve the approved portfolio; do not build a separate application or deployment per hostname. Keep data site-scoped and never stitch visitor identity between properties. Portfolio counts are allowed under section 18.7, but not blended cross-site pixel heatmaps. Its initial clock display is `Europe/Bucharest`; stored timestamps are UTC. Site, device, layout, campaign, date, and sample filters must be explicit. Screenshots and event data remain private.

A complete local build includes real persistence, migrations, real endpoint validation, authentication, a custom canvas renderer, tests, and operational scripts. A dashboard with hardcoded numbers is not a complete build.

### 1.2 Mandatory release-one capabilities

| Area | Required behavior |
| --- | --- |
| Properties | Data-driven brand/domain-group/market/family registry; one exact origin per property; disabled real-site seeds; public site keys; per-site permissions |
| Portfolio | Approved cross-property count reports, explicit campaign/page mappings, isolated heatmaps, extensible domains without rebuilding the SDK |
| Pages | Explicit origin/path/query selector registry; separate page key for each campaign landing page; independent enablement, locale, revision, variant, and approval |
| Tracking | Consented page views, pointer clicks/taps, non-coordinate keyboard activations, scroll summaries, approved element exposure |
| Heatmaps | Custom click renderer; scroll-reach overlay; approved element-relative mode; separate viewport layers |
| References | PNG/WebP screenshots, manifests, compatible-layout selection, version history, visible mismatch warnings |
| Analytics | Correct denominators, UTC-date reporting, coverage flags, sample-rate labels, bounded exports |
| Operations | Health checks, durable ingestion, retry safety, worker recovery, kill switches, retention, backups |
| Security | Loopback dashboard, login, CSRF protection, roles, origin validation, input limits, no public database |
| Delivery | Documented commands, same-path/different-query demo fixtures, automated tests, landing-page-scoped installer handoff, production-readiness report |

### 1.3 Things release one must not do

No session replay, DOM recording, screenshots of real visitors, keystroke logging, form-value capture, player identification, cross-domain identity stitching, cookies for visitor tracking, customer account linkage, financial analytics, audience targeting, or automatic A/B experimentation. Do not capture wager selections, deposits, balances, losses, bet histories, identity verification, self-exclusion, or responsible-gambling interactions.

This is an aggregate usability and page-quality tool, not a player-profiling system. Do not design features to exploit vulnerability, increase spending by identifiable players, or circumvent a visitor's consent choice.

### 1.4 Meaning of production-ready

Production-ready is a release decision supported by passing tests, a reviewed threat model, approved data handling, a measured capacity envelope, verified integrations, and a successful restore exercise. It is not a label Codex can assign merely because the code compiles. Separate these statuses in the UI and documentation:

`LOCAL_DEMO_READY -> STAGING_READY -> PILOT_APPROVED -> PRODUCTION_APPROVED`

Real site collection must remain disabled until its own approval record exists, even when the software itself is production-approved.

---

## 2. Facts, assumptions, and NetBet onboarding

### 2.1 Public observations, not an internal architecture audit

On 2026-10-16, opening `https://go.netbet.com/` in the research environment redirected to `https://www.netbet.com/`. The public Romanian casino and sport origins also returned pages. This does not establish the behavior of every campaign URL, geography, account state, or device. [R01][R02][R03]

Do not treat `go.netbet.com` as a guaranteed final landing-page origin. An HTTP redirect has no rendered page on which this tracker can observe behavior. Install on the actual HTML destination when authorized; separately record an approved campaign code if the host integration provides one.

Existing NetBet frameworks, tag managers, consent-manager APIs, traffic volumes, company-approved hosting, and production access were not verified. Limited internal discovery did not establish an existing heatmap specification. This document proposes a new architecture; it does not claim NetBet currently uses it.

### 2.2 Selected landing pages and optional domain catalog

The owner's corrected requirement is to choose individual campaign landing pages, for example:

```text
https://go.netbet.ro/casino/?lp=halloween
```

This supplies a candidate origin `https://go.netbet.ro`, path `/casino/`, and public page selector `lp=halloween`. It does not authorize the root URL, the entire `/casino/` path, any other `lp` value, `casino.netbet.ro`, `sport.netbet.ro`, or a parent website. The page content, final destination, deployment access, and actual selector behavior were not verified: fetching this exact example failed in the research environment on 2026-10-16. Treat the selector as the owner-supplied onboarding requirement, not a completed website audit.

Use `config/netbet-landing-pages.disabled.json` as the default real-page example. It contains only the requested Romanian Halloween target and its one necessary disabled origin record. All approvals remain pending, the release/context adapter is UNKNOWN, and collection stays off. Importing a candidate is not an installation or an activation. Do not fabricate `.com`, `.co.uk`, sport, or other campaign URLs merely by copying the example.

The platform must still support independently selected URLs on `go.netbet.ro`, `go.netbet.com`, `go.netbet.co.uk`, or another approved origin. An owner can select a public page on a casino/sport/parent host later, but none of those hosts is a prerequisite or an implicit rollout target. For `/casino/` and `/sport/` landing paths on a `go` host, product classification belongs to the page, not the host family.

The previous file `config/netbet-sites.disabled.json` remains an OPTIONAL host catalog for compatibility and additional onboarding:

| Domain group | Campaign-host candidate | Optional product-host candidates | Optional parent-host candidates |
| --- | --- | --- | --- |
| `netbet.ro` | `go.netbet.ro` | `casino.netbet.ro`, `sport.netbet.ro` | `netbet.ro`, `www.netbet.ro` |
| `netbet.com` | `go.netbet.com` | `casino.netbet.com`, `sport.netbet.com` | `netbet.com`, `www.netbet.com` |
| `netbet.co.uk` | `go.netbet.co.uk` | `casino.netbet.co.uk`, `sport.netbet.co.uk` | `netbet.co.uk`, `www.netbet.co.uk` |

These 15 combinations are unverified, disabled catalog entries, not required active properties. Normal onboarding need not import that catalog at all. Never show its unselected hosts as missing required installations or block launch of one selected landing page because unrelated hosts are absent. Archive/hide unused catalog records without discarding existing history.

Support additional markets/domains/hosts/pages through managed configuration, not source-code conditionals or another copy of the application. Use the full explicit group root `netbet.co.uk`, not `co.uk`. A group is organizational metadata, not consent, ownership, or wildcard trust. Set `market_code=null` until an owner assigns it; do not infer visitor geography or jurisdiction from a domain suffix.

Real-property records stay disabled until authorized. Synthetic development uses independent local-demo site IDs and fixtures, never fabricated analytics under a real hostname. No wildcard authorization of `*.netbet.ro`, `*.netbet.com`, or `*.netbet.co.uk` is allowed. Wider public-site tracking, when separately requested, is a distinct reviewed scope change and remains off by default.

### 2.3 Integration worksheet required for each origin

Record the brand, domain group, explicit market assignment or UNKNOWN, site family, business owner, technical owner, exact HTTPS origin, each selected path and rendering-query selector, explicitly excluded neighboring URLs, final redirect destinations, page framework, tag-manager ownership, CSP owner, consent-manager API, anonymous-public-context signal, release identifier, locale source, variant source, sensitive components, stable element IDs, asset-host allowlist, retention approval, hosting approval, and rollback owner. Complete this independently for every origin; shared branding does not prove shared integrations or approvals.

Every unverified field is `UNKNOWN`, not an invented value. Local implementation may continue using fixtures. Enabling real traffic is blocked on the missing approvals; do not block development just because production access is unavailable.

---

## 3. Architecture and operating modes

### 3.1 Logical flow

```text
APPROVED LANDING PAGE
  host consent + public-page eligibility
                |
                v
  first-party custom tracker.js
  memory-only page-view identity
  schema-limited batches, no page content
                |
             HTTPS
                v
PUBLIC INGESTION BOUNDARY
  gateway: SDK + public config + event POST only
  collector: validation, quotas, origin/site checks
                |
     database transaction + durable acceptance
                v
PRIVATE DATA PLANE
  PostgreSQL events + dedupe receipts + outbox jobs
                |
                v
  workers: view facts, rollups, retention, exports
                |
                v
PRIVATE MANAGEMENT PLANE
  authenticated API + dashboard
  approved screenshot store + layout manifests
  custom canvas heatmap renderer
```

The screenshot runner is an isolated, on-demand process. It is not part of the event request path and is not allowed direct database or secret-store access. It receives a constrained job, writes approved artifacts to a staging volume, and a trusted importer registers the result.

### 3.2 Mode A: completely local development

Everything runs on the owner's workstation. The dashboard is available at `http://127.0.0.1:3000`; demo pages at `http://127.0.0.1:4173`; the collector gateway at `http://127.0.0.1:8080`. All are loopback-published. PostgreSQL has no host-published port by default.

Use only demo traffic. After dependencies and images are installed, ordinary development and demo use must not require external analytics or AI services. A workstation sleeping or shutting down stops the stack, which is acceptable for this mode.

### 3.3 Mode B: temporary externally reachable test collector

The dashboard remains private and local. A temporary HTTPS tunnel exposes only the collector gateway. Approved testers on a company-controlled staging page can send synthetic or consented test data. The tunnel terminates when its process stops, and its hostname may change. This is not a production deployment. [R04]

Do not tunnel the dashboard, management API, database, screenshot runner, container socket, or filesystem browser. Do not publish a quick-tunnel snippet into a live campaign.

### 3.4 Mode C: local dashboard, durable remote collection

The owner can keep a local dashboard while an approved, always-on environment hosts the collector, database, worker, management API, and private reference storage. The dashboard reaches the management API through a loopback reverse proxy over an approved SSH/VPN/private connection. Database ports are never exposed to the internet.

A purchased personal domain is not necessary if the organization provides an approved subdomain or the approved hosting provider supplies a stable HTTPS hostname. Do not assert that a hostname or service has already been provisioned. Put actual values into environment configuration after approval.

### 3.5 Mode D: full production hosting

Move the management UI behind corporate authentication and a private network or an appropriately protected HTTPS entry point. Keep the collection origin separate from the management origin, including separate cookies and routing. Moving the dashboard must not require rewriting the event protocol or migrating visitor identities.

### 3.6 The localhost rule

A public website cannot send all visitors' events to the developer's `localhost`. In each visitor's browser, `localhost` refers to that visitor's own device. Therefore a snippet for an HTTPS live landing page must point to a publicly reachable, approved HTTPS collector. Never use mixed-content workarounds or tell users to disable browser security.

---

## 4. Technology decisions

These are project choices, not claims about NetBet's existing stack.

| Layer | Decision | Reason |
| --- | --- | --- |
| Language | TypeScript with strict checking | Shared contracts and safer refactoring |
| Runtime | Supported Node.js 24 LTS patch | Conservative server baseline; verify patch at implementation [R05] |
| Workspace | pnpm workspaces | One lockfile and shared packages |
| Tracker build | esbuild, isolated IIFE bundle | No React/runtime dependency on landing pages |
| API services | Fastify 5, compatible supported patch | Route schemas and bounded request handling [R06] |
| Validation | Repository-owned JSON Schema + Ajv | One runtime contract; reject unknown fields |
| Database | PostgreSQL 18, supported patch | Transactional ingestion, indexed queries, durable jobs |
| SQL access | `pg`, parameterized SQL, versioned SQL migrations | Explicit query and permission control |
| Dashboard | React + Vite | Static local UI; management API remains separate |
| Heatmaps | Own Canvas 2D renderer + typed numeric arrays | No external analytics/heatmap engine |
| Workers | Own bounded PostgreSQL-backed job loop | No Redis/Kafka required for the initial scale |
| Screenshots/tests | Playwright, pinned package/browser pair | Deterministic fixtures and reference capture [R07] |
| Storage | Private local volume via storage adapter | No cloud object-store dependency locally |
| Testing | Vitest, Playwright, HTTP integration tests | Contracts, numerical correctness, real browser behavior |
| Packaging | Docker Compose, multi-stage images | Reproducible local and single-host deployments |
| Reverse proxy | Caddy or nginx, choose one and document it | Explicit public/private route boundaries |

Lock all direct dependency versions and commit `pnpm-lock.yaml`. Pin released container images by version and deployment digest. Record the chosen versions and licenses in `docs/DEPENDENCIES.md`. Do not blindly use `latest`, obsolete dependencies, or unreviewed package-install scripts.

From scratch means the product logic is ours. Reusing a browser, database, web framework, maintained password-hashing library, or standards-compliant session library is desirable. Do not implement your own TLS, cryptographic RNG, image decoder, SQL parser, or password hash.

No runtime OpenAI API, model subscription, GPU, external analytics account, or paid mapping service is required.

---

## 5. Repository layout and engineering rules

```text
netbet-heatmap-studio/
  AGENTS.md
  README.md
  CODEX_START.md
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  .env.example
  .gitignore
  .dockerignore
  compose.yaml
  compose.dev.yaml
  compose.production.yaml
  apps/
    dashboard/                 # React/Vite, no secrets
    management-api/            # Auth, site setup, reports, export control
    collector/                 # Public config and event intake only
    worker/                    # Durable jobs and housekeeping
    screenshot-runner/         # Isolated, on-demand capture, no DB credentials
    demo-site/                 # Deterministic pages, fake CMP, responsive fixtures
  packages/
    tracker/                   # Browser-only runtime and IIFE entry point
    contracts/                 # JSON schemas + generated TypeScript types
    heatmap-renderer/          # Pure numerical functions + Canvas adapter
    db/                        # SQL migrations, role grants, query modules
    domain/                    # Canonicalization, sampling, metric definitions
    config/                    # Validated runtime config, secret redaction
    security/                  # Auth, CSRF, allowed-origin helpers
    storage/                   # Filesystem implementation and interface
    test-fixtures/             # Synthetic event and layout test vectors
  config/
    netbet-landing-pages.disabled.json
    landing-page-match.examples.json
    netbet-sites.disabled.json  # Optional compatibility catalog
  infra/
    proxy/
    docker/
    security/                  # Capture sandbox and egress policy
    monitoring/
  scripts/
    bootstrap.mjs
    doctor.mjs
    capture-reference.mjs
    import-reference.mjs
    backup.mjs
    restore.mjs
    load-test.mjs
    release-check.mjs
    generate-install-snippet.mjs
  tests/
    unit/
    contracts/
    integration/
    e2e/
    privacy/
    performance/
    recovery/
  docs/
    NETBET_HEATMAP_BUILD_SPEC.md
    LANDING_PAGE_SCOPE.md
    MULTI_DOMAIN_SCOPE.md
    IMPLEMENTATION_STATUS.md
    DECISIONS.md
    DEPENDENCIES.md
    THREAT_MODEL.md
    DATA_DICTIONARY.md
    OPENAPI.json
    MARKETING_INSTALL.md
    CONSENT_INTEGRATION.md
    OPERATIONS.md
    PRODUCTION_READINESS.md
    evidence/
```

Do not make a microservice for every feature. Collector, management API, worker, and capture isolation are meaningful boundaries; packages share code without sharing unrestricted database credentials.

Use dependency injection for the clock, RNG, storage, and transport where deterministic tests need them. Every SQL query accepts parameters. Every public route has response and request limits. Application errors must not leak raw event payloads, user input, SQL, secrets, or stack traces to callers.

Every milestone updates `IMPLEMENTATION_STATUS.md` with files changed, commands actually run, evidence, unresolved issues, and the next task. A mocked test is not proof of a production integration. Mark unavailable browser/security checks as unverified rather than silently passing them.

---

## 6. Local installation and developer experience

### 6.1 Workstation assumptions

Support Docker Engine with Compose on Linux and Docker Desktop with Linux containers on macOS/Windows. On Windows, document the WSL2 workflow and PowerShell equivalents. An engineering starting point is 4 CPU cores, 16 GB RAM, and 20 GB free storage; this is a development planning assumption, not a measured hardware minimum. Keep screenshot concurrency at one locally.

The container-only path must not require a globally installed Node.js or pnpm. A host-native development path may require the pinned Node/pnpm versions. Company policy must approve Docker licensing, local data storage, and any tunneling provider before their use.

### 6.2 Mandatory commands Codex must implement

The following are the acceptance interface of the future repository. They are not commands available in this documentation-only delivery.

```bash
# First-time container-only setup; never use production secrets here.
cp .env.example .env
# bootstrap is a tools-profile container; it generates local secrets,
# validates loopback bindings, and creates writable local directories.
docker compose --profile tools run --rm bootstrap

docker compose build
docker compose up -d db
# Migrations create roles/tables. Do not use the owner account at runtime.
docker compose run --rm migrate
docker compose up -d
# Interactive password entry, not a password command-line argument.
docker compose --profile tools run --rm admin-cli create-user
# Explicitly seeds local-demo only; never enables a NetBet origin.
docker compose --profile tools run --rm admin-cli seed-demo

docker compose ps
# Do not include -v: down must preserve volumes.
docker compose down
```

Also implement the host-native commands below, with real package scripts rather than documentation promises:

```bash
pnpm install --frozen-lockfile
pnpm doctor
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:contracts
pnpm test:integration
pnpm test:e2e
pnpm test:privacy
pnpm test:recovery
pnpm test:performance
pnpm test:multisite
pnpm test:landing-pages
pnpm release:check
```

`pnpm doctor` reports dependency versions, missing secrets, port conflicts, writable volumes, database schema version, active environment, enabled properties, unsupported host settings, and accidentally public interfaces. It must redact secret values.

### 6.3 Port and network contract

| Host binding | Service | Publicly tunneled? |
| --- | --- | --- |
| `127.0.0.1:3000` | Dashboard gateway; proxies `/api` to management API | Never |
| `127.0.0.1:8080` | Collector gateway; SDK/config/ingest allowlist only | Test profile only |
| `127.0.0.1:4173` | Demo landing pages | No |
| No published port | PostgreSQL | Never |
| No published port | Worker and screenshot runner | Never |
| No published port | Management API internal port | Never directly |

Publishing a Docker port to all host interfaces exposes it beyond localhost. Bind local services explicitly to loopback and verify actual reachability; do not rely on the word "local" in a service name. [R08]

Use named volumes for PostgreSQL and reference storage. Back up to a different approved location, not just another folder inside the same container. Maintain separate Compose project names and volumes for development and production.

---

## 7. Domain registry and page configuration

### 7.1 Site key and origin policy

Each exact-origin property receives its own random public key, such as `site_<random>`. It is routing metadata, not a password. Internal UUIDs and public keys are separate. Exact allowed origins include scheme and host and, where non-default, port. Production requires HTTPS. Release one enforces one origin per property; an apex host, its www host, and its product hosts are separate properties grouped for navigation. Do not use one shared site key for the whole domain portfolio.

Parse origins using a real URL parser and compare serialized origins. Reject credentials in URLs, `null` origins, suffix-match tricks, unapproved ports, unapproved IDN variants, and subdomains merely ending with a trusted string. `casino.netbet.ro.attacker.invalid` is not an approved origin.

Development HTTP is allowed only for explicitly synthetic development properties and never inherited by a real site. A site has `domain_group_id`, `site_family`, `host_label`, `environment`, `enabled`, `approval_state`, `config_version`, `sample_rate`, `max_daily_events`, `collection_mode=selected_pages`, an exact candidate origin with separate approval status, and `page_rules`. The legacy `page_rules` representation is derived from the selected-page registry, not a second independently editable source of active policy. The stored/API `origins` array is retained for schema compatibility but must contain exactly one entry in release one.

### 7.2 Landing-page matching and privacy-safe normalization

Match a selected landing page using the tuple `(exact origin, exact pathname, approved query-selector values)`, then emit its registered `page_key`. The default `collection_mode` is `selected_pages`. An origin allowlist, hostname match, or path match alone is insufficient. Unknown or ambiguous matches collect nothing; exclusions and current disabled/revoked policy always win.

For the owner's example, map `https://go.netbet.ro` + `/casino/` + exactly one decoded `lp` value equal to `halloween` to page key `casino-halloween`. The same path with `lp=christmas` is a different candidate and needs separate registration, approval, references, and metrics. Do not reduce these pages to a single `/casino/` heatmap or use an `unknown` page as a fallback.

Parse the URL locally with the standard URL parser. Inspect approved page-selecting query names BEFORE discarding the query. Compare decoded query values once, case-sensitively; do not double-decode or silently lowercase. Use all values for a name to detect duplicates, not only the first. Reject duplicate parameters, malformed percent escapes, credentials, ambiguous input, over-budget input, and unsupported route forms. Exact trailing-slash behavior is part of the selector. [R23][R24]

Only registered, reviewed rendering selectors may influence page identity. The default policy rejects other query names, except an explicit allowlist of non-rendering marketing parameters such as `utm_source`; those may be ignored for matching and are never emitted, logged, or retained as raw values. The owner must verify they do not change content. A query name cannot simultaneously be a rendering selector and an ignored parameter on the same origin/path. Missing or unknown required `lp` values mean no collection, NOT campaign `unknown`.

Store `canonical_path` as the approved static path and `page_key` as the complete registered page identity. The private management UI and capture runner may reconstruct an approved reference URL from the registered origin, path, and static public selector constants. Visitor event payloads never contain `location.href`, raw query strings, full referrers, arbitrary selector values, affiliate IDs, tokens, or account/search data.

Non-rendering campaign attribution is a separate optional controlled-code field. Prefer host-supplied static codes. Unknown attribution may become `unknown` without raw retention; that rule must never substitute for a missing/unknown page selector. Path-only targets are allowed only as explicit exact-page registrations, not as a fallback that swallows query-selected campaigns.

The collector validates site/origin, registered page identity, release, current page enablement, and configuration epoch. Because it does not receive raw visitor URLs, it cannot independently prove which browser address produced a claimed page key. Origin/CORS/site keys do not authenticate visitor traffic. Enforce the matcher in the host bridge and SDK, test their integration, and retain the documented rate/abuse controls; do not claim server-side URL attestation.

### 7.3 Release and state registration

Each supported page has a `revision` supplied by the page release, a locale, approved variant, approved presentation-state codes, and stable element definitions. A revision is a deploy/content identifier, not a hash of the visitor's DOM or text.

Revision changes that affect geometry require new reference artifacts. The runtime cannot quietly overlay new-page clicks on an old screenshot. Maintain a default `unknown` state that has counts but no trusted screenshot overlay.

Do not automatically infer exact NetBet login routes or CMP behavior from a public page. The example exclusion list in this specification is defense in depth, not an exhaustive map of the production applications.

### 7.4 Portfolio hierarchy and identifiers

Use this optional hierarchy for management and reporting, not visitor identification or a mandatory installation checklist. Only selected-page origins need records; omitted parents are valid:

```text
NetBet brand
  netbet.ro domain group / owner-assigned market
    go family       -> https://go.netbet.ro        -> approved pages/releases
    casino family   -> https://casino.netbet.ro    -> approved pages/releases
    sport family    -> https://sport.netbet.ro     -> approved pages/releases
    parent family   -> https://netbet.ro           -> approved pages/releases
                    -> https://www.netbet.ro       -> approved pages/releases
  netbet.com domain group / owner-assigned market
    same configurable families and exact-origin properties
  netbet.co.uk domain group / owner-assigned market
    same configurable families and exact-origin properties
  additional owner-registered domain groups
    any explicitly approved family and exact origin
```

`site_id` remains the authoritative partition, permission boundary, and ingestion identity. Domain groups and family codes are server-side registry metadata, not claims sent by the tracker. Resolve them through the validated site key and request origin. The existing event protocol stays version 1; do not add free-form host, market, brand, or country fields to visitor payloads.

A domain group stores its full explicit domain root. Do not derive grouping by taking the last two hostname labels, which would misclassify `netbet.co.uk`. Never use a grouping rule as an origin authorization rule. Ordinary pages are keyed by `(site_id, page_key)`: `homepage` at two different origins represents two different pages, even when their paths and visual designs match.

The local dashboard and collector hostnames are deployment configuration separate from tracked domain groups. Adding these website candidates does not require purchasing 15 domains or hosting 15 dashboards. Real integration still requires access and approval for the existing website origins and a reachable collector.

### 7.5 Generic registry and administration

Implement `brands`, `domain_groups`, and `site_families` as managed registries and connect `sites` to them. Seed NetBet as data, not conditions in tracker code, SQL query builders, route handlers, or React components. Family codes are registry-controlled safe identifiers; another family such as `promo` can be registered without editing a compile-time enum.

Support listing, creation, validation, update, archive, and disabled import of domain groups and properties. Archive rather than physically deleting a site with analytics history. After its first accepted event, the property's exact origin, domain-group identity, and site family are immutable in release one; a host move creates a new property and optional explicit comparison mapping. A market label may be corrected as audited reporting metadata; show the registry version and use current labels rather than implying historical visitor geography.

A normal candidate import creates only disabled metadata. Validate the whole bounded file before applying it transactionally. Provide a dry-run plan, conflict errors, and an audit entry. Generate a separate random site key on creation and preserve UUIDs/keys on an idempotent reimport. Never accept public keys, enabled states, approval grants, executable adapters, or arbitrary SQL from an import. Rerunning a seed cannot change the enablement, policy, or permissions of an existing record. Conflicting existing origins/slugs require explicit reconciliation, not destructive replacement.

Enforce one property per exact origin in a deployment registry and one origin per property. Synthetic integration tests use distinct origins, including separate loopback ports, with independent synthetic site IDs. Do not issue requests to real NetBet candidates just to generate test coverage.

### 7.6 Policy isolation, installation scope, and redirects

Each property independently owns its approvals, page rules, public key, CMP/eligibility adapter, sampling, quotas, releases, references, retention approvals, and kill state. A group-level template may propose settings but cannot enable sites, approve new routes, change consent policy, or propagate secrets. Enablement is an explicit per-property reviewed action. A global emergency stop is permitted; restoring it must not turn on previously disabled properties.

Disabling one Romanian sport property must not disable or reconfigure the Romanian casino, UK campaign, or parent properties. Global resource limits remain necessary so one property cannot exhaust the shared collector. Add bounded per-site queues/quotas, worker fairness, and scoped health diagnostics.

A parent-host installation does not instrument child hosts. Generate the handoff for each actual rendered origin. A shared template or authorized tag-manager container may load the same immutable SDK bytes, but it must select a reviewed exact-origin configuration and the correct per-origin site key. An unknown `window.location.origin` exits without config/events calls or fallback. Never use `endsWith('netbet.com')`, a wildcard site key, or a guessed nearest parent as an installation selector.

Handle `go` as a configurable family, not an assumption about delivery. Any go path may be rendered HTML, an HTTP redirect, or unavailable. HTTP redirects do not produce tracker page views at the redirecting origin. Track the independently approved rendered destination, and maintain any reviewed campaign/destination mapping in management metadata. Do not auto-approve that destination, carry visitor IDs or consent across origins, append tracking identity to URLs, or infer a cross-domain registration funnel. Parent-host redirects follow the same rule.

### 7.7 Explicit cross-property page and campaign grouping

Optionally register named `page_groups` and explicit members `(site_id, page_key)` for portfolio comparison, such as a reviewed campaign shown on several sites. Registration is manual and auditable. Identical URL paths, titles, `data-hm-id` values, or screenshots do not automatically create equivalence.

Pixel heatmaps, scroll overlays, reference images, and geometry cohorts always belong to one property/page/release. The portfolio screen can compare them side by side but cannot place events from different origins onto a single screenshot. Common campaign labels permit reviewed count summaries only; metric-definition version and sampling compatibility remain explicit. Section 18.7 defines valid rollups and permissions.

### 7.8 Upgrade from the earlier three-site scope

For a new repository start with selected landing pages from section 2.2. The 15-host catalog is optional and must not be automatically enabled or required. For an already initialized repository, do not drop databases or recreate properties. Match existing records by exact origin and keep their UUIDs, site keys, data, approvals, memberships, page keys, and audit history. Rename `netbet-go` to `netbet-com-go` only through a collision-checked audited metadata migration; identifiers referenced by events must not change. Preserve the existing `netbet-ro-casino` and `netbet-ro-sport` identities.

Add grouping/family metadata to retained records. Insert only explicitly requested missing origin candidates, always disabled; do not force-import unrelated parent/product hosts. If duplicate origins, multiple origins per property, or conflicting assignments exist, abort the automated migration and report the conflict. Do not merge analytics or silently discard an origin to satisfy the new constraint. In a populated implementation, add/backfill/validate registry constraints in a staged migration before applying NOT NULL/UNIQUE requirements. Update API contracts, generated types, fixtures, prompts, and tests together. The additive scope must not reset completed implementation work.

### 7.9 Selected landing-page contract: required in release one

#### A. The page, not the domain, is the onboarding unit

Implement an Add landing page URL flow with scope default `selected_pages`. An authorized operator pastes the URL privately, sees the exact origin/path/query selector, names the page, assigns a product/market label, and saves a disabled draft. Find or create only the necessary exact-origin property; do not create parent domains as dependencies. Reuse that property's site key for multiple selected pages on the same origin, while preserving separate `(site_id, page_key)` identities, approvals, kill switches, releases, references, and metrics.

A minimal default draft is:

```json
{
  "site_slug": "netbet-ro-go",
  "page_key": "casino-halloween",
  "display_name": "Casino - Halloween landing page",
  "product_code": "casino",
  "collection_mode": "selected_pages",
  "enabled": false,
  "approval_state": "pending",
  "selector": {
    "origin": "https://go.netbet.ro",
    "path": "/casino/",
    "query_equals": {"lp": "halloween"},
    "ignored_query_names": ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"],
    "other_query_policy": "reject",
    "duplicate_query_policy": "reject",
    "fragment_policy": "ignore_anchor"
  },
  "release_status": "UNKNOWN",
  "integration_status": "UNKNOWN"
}
```

The ignored-query list is a proposed reviewed-policy example, not a verified NetBet behavior. No real configuration is publishable until its content behavior, exclusions, consent bridge, page readiness, reference coverage, and exact destination are verified. Marketing attribution is not collected merely because a name appears in this list. An `lp` parameter is an owner-approved public template code here, not a generic permission to capture all parameters called `lp` on other sites.

#### B. Pure matching rules

Implement one pure, shared, schema-tested matcher for configuration preview, SDK lookup, generated host bridges, and capture-policy validation. Do not implement four subtly different matchers. The authenticated management server validates selectors before publishing them; visitor collection never sends full addresses for remote matching.

1. Reject invalid inputs before matching. Project defaults: maximum 8,192 characters in a transient URL, 2,048 characters in its query, 32 query pairs, and eight rendering-selector keys per target. Never log the rejected input.
2. Parse an absolute URL, forbid userinfo, require the registered exact origin and HTTPS except an explicitly synthetic loopback fixture. Reject malformed percent escapes and raw backslashes. Do not invent custom hostname parsing.
3. Compare the parser's pathname exactly. `/casino/`, `/casino`, and `/Casino/` are distinct unless separately reviewed aliases exist. Encoded slashes or ambiguous path forms fail closed under the route validator. Do not follow or fetch the URL while matching.
4. Inspect decoded query pairs. Reject repeated decoded names even when values are identical; `lp=halloween&lp=christmas` must never depend on first/last-value behavior. One decoding pass is enough. For example, `hallow%65en` parses to `halloween`; `%2568alloween` is not decoded a second time to make it match.
5. Every `query_equals` entry must be present exactly once with the exact configured value. Every other key must be in the reviewed `ignored_query_names` allowlist. Otherwise return no match. All query values are transient and absent from diagnostics, events, and storage.
6. An ordinary anchor fragment can be ignored only under `ignore_anchor`. Hash-routed pages require their own explicitly reviewed host adapter and must not silently enter this mode. Sensitive overlay/context exclusions still win when the address is unchanged.
7. Exactly one enabled, approved selector must match. Zero or multiple matches means inactive. Validate selector overlaps transactionally when publishing configuration, including conflicts between ignored and rendering keys. Do not resolve ambiguity with order-dependent first match, priorities, or a broad catch-all.
8. Return only the registered page key and policy metadata. Combine the match with current host eligibility, ready release/layout context, consent, local installation allowlist, server approval, sampling, and kill-state gates. A match alone is never permission to collect.

#### C. Loader gate and installation granularity

The recommended installer contains a small host-owned, same-origin bootstrap and a bounded manifest of only the selected approved pages. It checks the address and host context locally before downloading the SDK or contacting the collector. This avoids fetching remote configuration merely to discover that a page is out of scope. The bootstrap must not record behavior, create identities, or poll analytics when unmatched or before consent.

Install on the specific campaign template when possible. A shared landing-page template or tag-manager container is acceptable only with exact host + path + selector triggers and the same independent bootstrap guard. An All Pages tag or hostname-only trigger is not the default. Unknown routes, other campaigns, parent sites, and product homepages cause zero SDK/config/event requests under this loader, even when consent was granted elsewhere on that origin.

The SDK independently verifies the current selected-page match. Host calls cannot override it by supplying an approved `pageKey` while the browser is on another page. Public remote configuration may narrow/disable a local manifest; it cannot broaden collection beyond the installed manifest. Adding another target may therefore require publishing an updated host manifest/tag rule as well as server config. Do not promise remote auto-installation on arbitrary pages.

Generate an installer for a selected page or selected page set, grouped by exact origin only for deployment convenience. Explicitly show Included URLs and Not included URLs. Selecting Halloween must not select every `/casino/` campaign or any parent website. Several pages on the same origin share immutable SDK bytes and a site key, not page approval or analytics identity.

#### D. Navigation, query changes, and target shutdown

Treat a change in page-selecting query values as a potential new page even when `pathname` stays unchanged. Explicit router integration is preferred. A legacy fallback must observe the documented history APIs and back/forward navigation; query-only `pushState`/`replaceState` calls cannot be ignored. History state changes do not imply that new page content is ready. [R25]

Before a target/context change, invalidate pending callbacks with a lifecycle generation, pause observers, clear unsent old-page data as necessary, and wait for a consistent URL + host page context + ready release. Never label the old page's DOM as the new page during a render transition. If the new target is unselected, denied, disabled, or ineligible, destroy active tracking and stop configuration polling; do not send a last batch from that unselected context. Already transmitted requests cannot be recalled.

Changing only an ignored attribution parameter or ordinary anchor does not create another page view when the resolved target and approved host context remain unchanged. Removing `lp`, changing it to an unregistered value, or leaving for a parent/product site does not carry the old page key, view ID, or consent across the destination. A return to a selected page starts a fresh eligible view after gating.

Disable one target without disabling approved sibling targets on the same origin. Server config versions and page kill state must be enforced at ingestion, including retries from older configs. The origin-level and global emergency stops remain available. A background configuration request already sent before exit cannot be recalled; no new polling may start afterwards.

#### E. Page identity, screenshots, and reporting

`page_key` is a registered identity that already includes the selected rendering-template choice. Keep `casino-halloween` distinct from a separately approved `casino-christmas` even though both use `/casino/`. Non-rendering attribution belongs to separate controlled labels. Do not use the path as a unique database key, cache key, screenshot identifier, grouping key, or implicit page identity.

Key every view, metric, heatmap cell, export, and reference by at least site/page/release plus the established locale/variant/state/geometry dimensions. A reused seasonal URL with new content needs a new revision and compatible reference; the URL alone does not prove unchanged geometry. Product classification can be `casino` or `sport` on a `go` host and must not require an installed casino/sport parent property.

The capture runner reconstructs its target from the approved origin/path/selector constants. It must preserve `?lp=halloween`; capturing `/casino/` or the root instead is a mismatch. Validate the final page after redirects and its host-supplied release/context. If it redirects to an unselected parent/homepage, stop and report a mismatch; never approve that destination or substitute its screenshot automatically. No automated capture was performed for the owner's example in this delivery.

Portfolio counts can compare selected pages using existing compatibility and permission rules. Pixel overlays cannot merge distinct campaigns merely because their host, path, product name, or a label matches. The app must work with exactly one landing-page record and no parent-host records at all.

#### F. Wider site coverage is an optional separate decision

Release one must not depend on full-site tracking. Keep `selected_pages` as the only enabled default mode. An operator can add more exact public pages intentionally. A later, explicitly requested wider-site mode must show its scope, require new authorization and privacy/context validation, and preserve sensitive-page exclusions. It must never be activated by importing a host, adding a domain group, selecting a parent, or detecting another NetBet hostname. No request in this document authorizes that expansion.

### 7.10 Upgrade from version 1.1.0 without losing work

Prepare an additive migration plan and preserve all existing site UUIDs, keys, memberships, views, references, audit logs, and status evidence. Do not drop the database, reset implementation progress, or import all 15 hosts as a new mandatory step. Existing unused catalog properties may stay disabled/hidden. Generate a reviewed change plan before affecting a live deployment; this documentation update authorizes no live modification.

Add selected-page selectors and per-page enablement. Existing path-only policies must be reviewed and fail closed if they could combine query-selected templates. Known campaign targets get distinct new page keys or retain existing keys only when their historical meaning is already specific and evidenced. Never relabel mixed `/casino/` history as Halloween based on the current URL, copy another campaign's references, or manufacture a historical split. Keep ambiguous history marked legacy/unclassified and exclude it from new campaign overlays.

Version the public configuration/host-manifest schema to 2 for required selectors and scope rules; the event envelope remains version 1 because it still carries registered page keys, not raw URLs. Maintain a compatibility table. Do not serve selector-dependent enabled configurations to an old path-only SDK; return a disabled/upgrade-required configuration and require the reviewed SDK/manifest release. Use existing config-version history for stale-policy validation.

Update contracts, migrations, current example config, installer generation, site/page APIs, query-aware router fixtures, cache/report keys, capture selection, documentation, and LP-01 through LP-30 together. Mark runtime tests NOT_RUN until executed. Read existing implementation status and apply this scope correction rather than rebuilding completed components.

---

## 8. Privacy, consent, and collection eligibility

### 8.1 Default collection policy

All real-site tracking is opt-in under this engineering policy. Do not assume that a first-party script, no cookies, local hosting, or random IDs creates a legal exemption. Random identifiers and minimized behavior records are not automatically anonymous; treat the event store as potentially personal data. The organization's privacy/legal owner must determine the applicable requirements and approvals. [R09][R10][R11]

This document does not certify GDPR, Romanian ePrivacy, gambling-regulatory, or international-transfer compliance. Require a documented purpose, applicable legal assessment, retention decision, access policy, vendor/processor review, and a DPIA screening before real collection. Use a company-managed and approved workstation for any live data, not an unapproved personal machine.

### 8.2 Three independent gates

Collection is permitted only when all three are true:

```text
current analytics consent == granted
AND selected URL match AND host page context == explicitly eligible public anonymous page
AND current server configuration == enabled and approved
```

Unknown, loading, denied, revoked, or error states mean no collection. Consent evidence remains the host CMP's responsibility; the tracker records only a bounded consent-policy version and `analytics=true` assertion for accepted views, not the complete CMP string or customer identity.

On any unmatched landing page, the host bootstrap exits without SDK/config/events calls even when consent is granted. Before consent: no tracker download in the recommended installation, no config/ingest requests, no interaction listeners, no identifiers, and no browser persistence. A tiny host-owned consent bridge may run, but it must not sample behavior or contact the collector. If an organization elects to preload a static script, that requires a separately approved policy and is not the release-one default.

After consent withdrawal: remove listeners/observers, cancel timers and pending fetches when possible, clear in-memory queues and IDs, stop config polling, and do not flush buffered events. Requests already sent cannot be recalled; disclose this limitation. On later re-grant, create a new view ID and never replay pre-consent or revoked-period activity.

### 8.3 Public-page eligibility

The host integration must explicitly supply `eligible: true` only on approved, anonymous marketing contexts. Default is false. The tracker must not inspect login cookies, parse user profiles, or scrape the DOM to guess authentication state.

Switching into an account, registration form, deposit overlay, sportsbook betslip, game session, or other excluded state must immediately call `setContext({eligible:false,...})` before that UI becomes trackable. Returning to a public context creates a new view. Route rules remain a second layer because sensitive overlays can appear without changing the URL.

If a property cannot provide a reliable host eligibility signal, restrict the integration to dedicated static landing pages rather than instrumenting its whole product application.

### 8.4 Fields and regions never collected

Never read or serialize `input.value`, `textarea.value`, passwords, form data, clipboard, text selection, keyboard content, `innerHTML`, `outerHTML`, `textContent`, arbitrary labels, arbitrary URLs, cookies, local storage, customer IDs, device fingerprints, exact location, or full user-agent strings.

Never record clicks or exposure within forms, editable elements, private account/payment/betting widgets, or `[data-hm-ignore]` ancestors. An explicit `[data-hm-private]` region excludes the complete subtree and coordinates intersecting that region, not merely its text. The collector rejects unknown field names rather than storing arbitrary metadata.

Trusted registry IDs are allowed, for example `hero-register` or `terms-link`. These are developer-defined non-personal constants. Do not derive an ID from visible text, the `name` attribute of an input, email-containing CSS selectors, or a content hash.

### 8.5 IP addresses, headers, and operational logs

Network infrastructure inevitably processes connection metadata. Do not claim it never sees IPs. Do not persist raw IPs, raw URLs, Cookie, Authorization, Referer, full UA, or event bodies in application logs. Review proxy, tunnel, CDN, hosting, access-log, and crash-report settings too.

For abuse control, use transient per-process counters keyed by a short-lived salted HMAC of an IP or network bucket; avoid persisting the raw source IP. Rotate and expire the key/counters, and document the residual limitations. This is an operational minimization choice, not an assertion of anonymization or a replacement for provider review.

No tracker data should be sent to Codex, an external LLM, telemetry vendor, or crash analytics service. Use generated fixtures when seeking coding help.

### 8.6 Additional privacy controls

Honor a host-provided opt-out and, as a project preference, treat supported global privacy signals and `doNotTrack` as an additional opt-out unless the privacy owner specifies a stricter policy. Do not describe these browser signals as universal legal standards.

Do not track people believed by the host to be minors. Do not infer age or vulnerability from behavior. Do not track self-exclusion, addiction-support, or responsible-gambling help journeys. Apply the minimum reporting threshold defined in section 18, while recognizing suppression is not proof of anonymity.

---

## 9. Tracker public API and installation

### 9.1 Runtime namespace

The IIFE exposes one namespace, `window.NBHeatmap`, with no framework dependency and no global prototype modifications except a carefully reversible navigation fallback when explicitly enabled.

```ts
export type ConsentState = 'unknown' | 'granted' | 'denied';

export interface PageContext {
  eligible: boolean;
  pageKey: string;        // matched origin/path/query target, never the raw URL
  revision: string;       // approved deploy/content revision
  locale: string;         // registered locale, e.g. ro-RO
  variant: string;        // registered code, e.g. control
  state: string;          // registered presentation state, e.g. public-default
  campaign?: string;     // registered coarse code only
}

export interface LandingPageSelectorV2 {
  origin: string;
  path: string;
  query_equals: Readonly<Record<string, string>>;
  ignored_query_names: readonly string[];
  other_query_policy: 'reject';
  duplicate_query_policy: 'reject';
  fragment_policy: 'ignore_anchor' | 'reject';
}

export interface InstallationManifestV2 {
  schema_version: 2;
  site_key: string;
  manifest_version: number;
  collection_mode: 'selected_pages';
  pages: readonly {
    page_key: string;
    selector: LandingPageSelectorV2;
  }[];
}

export interface InitOptions {
  siteKey: string;
  endpoint: string;      // origin only; HTTPS except isolated local-demo
  consent: ConsentState;
  consentPolicyVersion: string;
  context: PageContext;
  installationManifest: InstallationManifestV2; // locally installed upper bound
  debug?: boolean;       // local diagnostics, never event-payload console logs
}

export interface HeatmapSDK {
  init(options: InitOptions): Promise<void>;
  setConsent(state: ConsentState, policyVersion: string): void;
  setContext(context: PageContext): void;
  trackAction(actionId: string): void; // only registered semantic actions
  flush(): Promise<void>;            // no-op unless currently permitted
  destroy(): void;
  getStatus(): {
    state: string;
    reason?: string;
    queuedEvents: number;
    configVersion?: number;
  };
}
```

`init` is idempotent for the same site key and installed manifest version. Validate the manifest as bounded trusted installation data, verify its site key/origins, and apply it as an independent upper bound on public config. A conflicting manifest requires an explicit safe teardown and reviewed reinitialization, not an in-place scope widening. A duplicate installation must not double-count or register duplicate observers. Reject a conflicting second site's initialization with a safe diagnostic. Public configuration cannot execute custom JavaScript or selectors of arbitrary complexity.

Do not expose a generic `track(name, arbitraryObject)` API. It makes privacy, payload bounds, and analytical semantics unenforceable.

### 9.2 Illustrative loader contract

The snippet below describes a host-owned integration file after the SDK exists. `cmp` and `pageContext` are interfaces the site's developer must implement; they are not verified NetBet APIs.

```ts
// host-integration.ts: bundled into an approved same-origin asset.
// The build injects real, verified configuration. Never use .invalid live.
const COLLECTOR = 'https://collector.example.invalid';
const SITE_KEY = 'site_REPLACE_FROM_APPROVED_PROPERTY';
// Generated static manifest; this method belongs to the illustrative host adapter.
const INSTALLATION_MANIFEST = pageContext.installationManifest();
let loadPromise: Promise<void> | undefined;
let latestConsent: ConsentState = 'unknown';
let latestContext: PageContext = pageContext.current();

async function ensureSdk(): Promise<void> {
  if (window.NBHeatmap) return;
  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${COLLECTOR}/sdk/v1/tracker.VERSION.HASH.js`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      // The release builder inserts the real sha384 digest here.
      script.integrity = 'REPLACE_WITH_RELEASE_SRI';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('SDK_LOAD_FAILED'));
      document.head.appendChild(script);
    }).catch((error) => {
      loadPromise = undefined;
      throw error;
    });
  }
  return loadPromise;
}

async function synchronize(): Promise<void> {
  // This adapter sets eligible=false unless the local selected-page matcher
  // and host public-context/readiness checks both pass.
  if (latestConsent !== 'granted' || !latestContext.eligible) {
    // Invalidate old-page eligibility before applying even a granted consent.
    window.NBHeatmap?.setContext({ ...latestContext, eligible: false });
    window.NBHeatmap?.setConsent(latestConsent, cmp.policyVersion());
    return;
  }
  try {
    await ensureSdk();
    // Consent/context may have changed while the script was downloading.
    if (latestConsent !== 'granted' || !latestContext.eligible) return;
    await window.NBHeatmap.init({
      siteKey: SITE_KEY,
      endpoint: COLLECTOR,
      consent: latestConsent,
      consentPolicyVersion: cmp.policyVersion(),
      context: latestContext,
      installationManifest: INSTALLATION_MANIFEST,
    });
    window.NBHeatmap.setConsent(latestConsent, cmp.policyVersion());
    window.NBHeatmap.setContext(latestContext);
  } catch {
    // Analytics must not break navigation, registration, or page rendering.
    // Surface only a non-personal code in an explicitly enabled local debugger.
  }
}

cmp.subscribeAnalytics((state) => {
  latestConsent = state;
  void synchronize();
});
pageContext.subscribe((context) => {
  latestContext = context;
  void synchronize();
});
```

The `pageContext` adapter must recompute exact path/query scope before this snippet runs and before every navigation/context change. It must not mark all same-origin pages eligible. Codex must implement race-safe serialization of overlapping `synchronize`/`init` calls and an actual typed host-adapter example against the demo CMP. The illustrative snippet is a contract, not an untested production integration. A deployed installer must contain a real artifact hash and endpoint, and the snippet generator must reject every placeholder.

### 9.3 Element instrumentation

```html
<main data-hm-scope="public-landing">
  <section data-hm-id="hero" data-hm-exposure="section">
    <a href="/approved-public-destination"
       data-hm-id="hero-register"
       data-hm-action="registration-start">
      Register
    </a>
  </section>
  <section data-hm-id="benefits" data-hm-exposure="section"></section>
  <aside data-hm-private="true">
    <!-- Entire region is excluded from tracking and reference capture. -->
  </aside>
</main>
```

Only registered IDs count. An element with an unknown ID is not automatically trusted. Report missing/duplicate IDs in the local integration debugger and capture validator without uploading DOM text.

---

## 10. Tracker lifecycle, navigation, and sampling

### 10.1 State machine

Implement and unit-test:

```text
UNINITIALIZED
  -> WAITING_FOR_PERMISSION
  -> FETCHING_CONFIG
  -> DISABLED | SAMPLED_OUT | ACTIVE
ACTIVE
  -> PAUSED_HIDDEN
  -> WAITING_FOR_PERMISSION  (revocation / ineligible context)
  -> DISABLED                (server kill / invalid configuration)
  -> ACTIVE                 (new approved route, new view)
ANY -> DESTROYED
```

No event can be enqueued or sent without a fresh permission check. Check both at capture time and immediately before transport. An asynchronous callback must not resurrect a revoked view; use a monotonic lifecycle generation number and abort controllers.

### 10.2 Identity and sampling

Use `crypto.randomUUID()` or a standards-based cryptographic fallback for a memory-only `view_id` after permission is established. Do not create a persistent visitor or session ID. On a new document, approved route change, consent re-grant, or materially different page context, create a new view.

A view is the counting unit. The dashboard must say `tracked page views`, not `unique visitors` or `sessions`. There is no cross-tab or cross-domain stitching.

Sample the complete view once using a cryptographic random draw against the configured probability. Keep its selected status and `sample_rate` fixed for the lifetime of that view. Never sample clicks independently of their denominator. Record the config version and rate on every accepted batch. Keep immutable configuration history for at least the maximum view lifetime plus event-delay window. A sample-rate change applies to new views; an existing view retains its original issued rate/config epoch. Current restrictive site/page/consent policy always overrides an older configuration. A material context/policy change closes the old view rather than changing its identity in place. Real-property defaults are disabled; pilot rate is an explicit approval decision. Demo can use 100%.

A viewport segment changes when geometry or layout state materially changes. It has a random `segment_id` and an ordinal within the same view; resizing is not automatically a new page view. Segment-level maps use segment-level denominators; whole-page metrics deduplicate by view.

### 10.3 Lifecycle and navigation

Prefer explicit router integration calling `setContext`. For approved legacy pages, support a fallback for `pushState`, `replaceState`, and `popstate`, restoring original functions on destroy and preserving arguments, return values, and `this`. Never assume a path or query change maps to an approved page without a registry match. Query-only changes to `lp` are mandatory navigation cases; section 7.9 defines transition readiness, inactive destinations, and ignored-query handling.

Do not use `unload` or blocking synchronous requests. Flush bounded data on `visibilitychange` when becoming hidden. That event and network delivery are best-effort; a final event is not guaranteed. [R12]

When a page enters the back/forward cache, pause without adding duplicate listeners. A persisted `pageshow` resume can continue the same view only if context, consent, and lifetime remain valid. Recheck permission before resuming. A view expires after 30 minutes without eligible interaction and at 24 hours absolute lifetime; the next eligible interaction starts a new view. These are project counting rules, not browser-defined sessions.

### 10.4 Resource budgets

Initial project targets: tracker at most 35 KiB gzip including runtime dependencies; bounded memory queue at most 200 events and 128 KiB serialized data; no pointer-movement stream; no complete DOM traversal on clicks; no continuous MutationObserver over the entire site. Measure the actual implementation.

Default normal flush every 5 seconds, at 20 queued events, or before a context transition while still permitted. An event batch is capped at 24 KiB UTF-8 and 50 events, whichever comes first. Queue overflow drops lower-priority repetitive progress updates before page/context/click events and raises a bounded diagnostic counter. A loss counter itself is best-effort and does not establish total missing traffic.

Use passive scroll listeners with a scheduled/throttled measurement, not a synchronous layout read for every scroll event. Prefer registered-region ResizeObserver/IntersectionObserver where useful. Capture handlers should be p95 below 2 ms in the defined test fixture, not a universal claim for every device.

---

## 11. Event schema and transport contract

### 11.1 Envelope

Generate TypeScript types, JSON Schema, sample payloads, and OpenAPI descriptions from one checked-in contract. Use `additionalProperties: false` at every object boundary. Explicitly disable body coercion and silent unknown-field removal so privacy failures are rejected rather than normalized away. Fastify's validation/content-type behavior must be configured and tested, especially if any alternate content type is introduced. [R06]

```ts
type EventType =
  | 'page_view'
  | 'segment_start'
  | 'click'
  | 'activation'
  | 'progress'
  | 'exposure';

type PositionLayer = 'document' | 'fixed' | 'sticky' | 'element-only';

interface BatchV1 {
  schema_version: 1;
  sdk_version: string;
  site_key: string;
  batch_id: string;             // UUID; transport/retry diagnostic
  config_version: number;
  view_id: string;              // UUID; memory-only per view
  view_started_at: string;      // ISO UTC; server sanity checks apply
  sample_rate: number;          // 0 < value <= 1
  consent: { analytics: true; policy_version: string };
  context: {
    page_key: string;
    revision: string;
    locale: string;
    variant: string;
    state: string;
    campaign: string;           // registered code or 'unknown'
  };
  events: EventV1[];
}

interface EventBase {
  event_id: string;             // UUID, unchanged across retries
  seq: number;                  // increasing within the view, not a global ID
  type: EventType;
  elapsed_ms: number;           // performance-clock offset within view
  segment_id: string;
  viewport: {
    width: number; height: number; dpr: number;
    visual_scale: number; visual_offset_x: number; visual_offset_y: number;
    scroll_x: number; scroll_y: number;
    document_width: number; document_height: number;
  };
}
```

The union `EventV1` must define the following payloads, with exact bounds and no arbitrary properties:

| Event | Additional payload | Meaning |
| --- | --- | --- |
| `page_view` | None | Initial consented, sampled page view; sequence starts at zero |
| `segment_start` | `segment_ordinal`, `geometry_state` | A new geometry/presentation segment, not a new visit |
| `click` | `client_x/y`, `document_x/y`, `pointer`, optional registered target/relative position, `layer` | One primary activation with real coordinates |
| `activation` | Registered `action_id`, optional registered `element_id`, `method` | Semantic activation; no invented coordinates |
| `progress` | `max_reach_px`, `max_reach_percent`, `max_scroll_percent`, `visible_ms`, `geometry_stable` | Cumulative state within that segment |
| `exposure` | Registered `element_id`, `qualified_ms`, `threshold`, `first_qualified` | A defined eligible element exposure |

The `click` payload's optional target object has only `element_id`, `x_fraction`, `y_fraction`, and the measured bounding rectangle. It cannot contain CSS selectors, HTML, text, href, values, or arbitrary attributes.

### 11.2 Bounds and invariants

Limit ordinary code fields to 64 characters, site keys to 96, SDK versions to 32, and envelope depth to a small fixed schema. Use bounded ASCII identifier alphabets for registered codes, not arbitrary Unicode or executable selectors; escape an ID when inserting it into a fixed selector template. The actual origin/URL parser has its own separate validation rules. Coordinates must be finite numbers, not NaN/Infinity, and within validated bounds with a small rounding tolerance. Initial supported viewport dimensions are 240..7680 CSS pixels wide and 200..4320 high; unsupported measurements can retain coarse counts but must not generate a trusted overlay. Cap document height at 100000 CSS pixels for collection and use a lower capture/export limit.

Reject event lists above 50, oversized bodies above 32 KiB at both proxy and application, unsupported schema versions, impossible sample rates, duplicate event IDs with different payload hashes, invalid UUIDs, unregistered page/revision/variant/campaign codes, and unauthorized origins.

Treat all browser claims as untrusted. The server derives `site_id`, `origin`, `received_at`, and environment. It never accepts client-provided tenant ownership, permissions, retention, approved origin, or database timestamps.

Use server receipt time for ingestion partitions. For analysis, derive a validated view start: reject absurd future/past times, accept events delayed at most 24 hours, and mark clock adjustments in quality metadata. Validate each derived occurrence time (client view start plus elapsed milliseconds) against server receipt time: at most 24 hours old and at most five minutes ahead. A start may be up to 48 hours old only when the bounded view lifetime and event delay jointly justify it. Normalize a small accepted clock skew once at first receipt, retain the original start/context hash, and reuse the stored normalization for all retries and later batches. Store the entire view under one UTC start date to prevent midnight double-counting. A maximum 24-hour view lifetime and late-arrival window define finalization behavior.

### 11.3 Transport

Primary transport is `fetch` with `method:'POST'`, `mode:'cors'`, `credentials:'omit'`, `Content-Type:'application/json'`, `referrerPolicy:'no-referrer'`, and a bounded timeout. Use `keepalive:true` for a small hidden-page flush, not for large uploads or unbounded queues.

Cross-origin JSON generally requires CORS preflight. Implement and test `OPTIONS` explicitly; do not use `no-cors` to hide failures. CORS governs browser response access and is not client authentication or bot prevention. [R13]

Default release one does **not** use `sendBeacon`, because it does not expose request results or an explicit credentials-omit option. A future approved fallback needs a dedicated review of cookies, MIME handling, queue limits, and delivery semantics. Browser keepalive/beacon delivery is constrained and best-effort; `sendBeacon(true)` would mean queued, not committed to our database. [R12]

Set the collector to ignore Cookie/Authorization headers and strip them before downstream processing. A dedicated collector origin must never set authentication cookies. When the collector shares a registrable parent domain with the site, explicitly verify inherited-cookie behavior and proxy redaction rather than assuming isolation.

### 11.4 Retry rules

The collector returns `204` only after a durable commit. Production requires PostgreSQL WAL/fsync settings and storage semantics that support that durability, including `synchronous_commit=on`; do not disable durability settings to make a benchmark pass. Repeating identical accepted event IDs returns `204` without duplication. Network errors, `408`, `429`, and `5xx` are retryable; use bounded exponential backoff with jitter and honor bounded `Retry-After`. Do not retry other `4xx`, invalid-schema responses, or disabled-site responses.

Retry at most three times while the page remains eligible and the queue lifetime is at most 60 seconds. No localStorage, IndexedDB, service-worker, or cookie-backed offline queue. On tab close, page crash, expiry, or revocation, unsent events can be lost. The dashboard must not claim complete coverage.

A queued event retains its original event ID. Do not regenerate IDs after an ambiguous response. Split batches before sending; never re-ID already accepted events when repackaging.

---

## 12. Accurate click coordinates and layout compatibility

### 12.1 Coordinate spaces

Use CSS pixels for tracker and manifest geometry. Canvas backing pixels are a rendering detail. For ordinary unzoomed document content:

```text
document_x = event.clientX + window.scrollX
 document_y = event.clientY + window.scrollY
```

`getBoundingClientRect()` returns a viewport-relative box; adding current scroll offsets converts it to document coordinates. Do not add scroll twice. [R14]

Capture the visual viewport scale/offset where available. When zoom, transforms, nested scroll containers, cross-origin frames, or sticky states make document projection unverified, retain a classified unsupported/excluded count or use an approved element-relative mapping. Do not invent a universal correction by multiplying every coordinate by DPR or viewport ratio.

### 12.2 Element-relative mapping

For a visible, registered, unrotated target rectangle:

```text
u = (client_x - rect.left) / rect.width
v = (client_y - rect.top) / rect.height
reference_x = reference_rect.left + u * reference_rect.width
reference_y = reference_rect.top  + v * reference_rect.height
```

Require positive dimensions and valid fractions within rounding tolerance. Small overshoots may be clamped after classification; large overshoots indicate bad mapping and are excluded. Match the same approved element ID, revision, locale, variant, and compatible state. Do not map one carousel slide or translated layout onto another merely because a button shares a name.

### 12.3 Strict document mode

Strict document overlays require compatible `site + page + revision + locale + variant + state + viewport width + geometry segment` and a matching reference. A mobile/desktop flag alone is insufficient.

Default strict mode uses exact integer layout viewport width and compatible document height/landmark geometry. A configurable tolerance such as 2 CSS pixels must be proven on fixtures and disclosed; it cannot silently stretch substantially different pages. Dynamic height changes create a new segment and invalidate strict overlays until a compatible reference or element mapping exists.

Broad width buckets, for example mobile/tablet/desktop, are useful for summary counts. They are not sufficient evidence that pixel coordinates share a common page layout. If a width lacks a reference, show counts, a clearly marked unreferenced state, and the capture/import action.

### 12.4 Fixed, sticky, and unusual elements

Record viewport-fixed elements in a separate `fixed` layer using viewport coordinates and matching viewport dimensions. Record sticky elements with their registered state and use element-relative maps by default. Do not project a sticky header at the visitor's current scroll Y onto the normal page image.

Keyboard activations have no pointer position and contribute to action metrics only. Do not plot a fake hotspot at `(0,0)` or at the center of a button. Count taps once using a consistent click-activation strategy, not both `touchend` and `click`.

Ignore cross-origin iframe internals, closed shadow roots, canvas game internals, and unregistered nested scrollers. Supporting an owned iframe later requires instrumentation within that frame and a reviewed origin-checked message protocol, not cross-origin security bypasses.

### 12.5 Required quality indicators

Every heatmap response includes total eligible observations, mapped observations, incompatible-layout exclusions, private-region exclusions where available, unsupported-geometry exclusions, reference version, sample rate, aggregation version, and data freshness. Missing observations are never silently positioned.

The UI must say `Reference layout` rather than implying it reproduces each visitor's exact rendered page.

---

## 13. Scroll, exposure, and CTA definitions

### 13.1 Two distinct scroll measures

For stable document height `H`, viewport height `V`, and nonnegative document scroll `Y`:

```text
viewport_bottom = min(H, Y + V)
reach_percent = 100 * viewport_bottom / H
scroll_progress_percent = 100 * Y / max(H - V, 1)
```

When the page fits within the viewport, define reach as 100% and scroll progress as 0%. Reaching content without scrolling is not the same as scrolling to the bottom. Track the maximum of each within a stable segment.

A scroll-reach map at depth `d` means the viewport's bottom reached that document position in the observed segment. It is not evidence the visitor read or even looked at every pixel above it. Starting at a fragment, browser-restored scroll position, or programmatic jump must be labeled because reach does not imply cumulative exposure.

For dynamic height, reset the progress measurement into a new geometry segment. Do not carry a former 100% percentage into a longer page and call it bottom reach. Keep height/segment coverage explicit. Infinite-scrolling applications are outside strict scroll-map support in release one.

### 13.2 Progress collection

Measure initial reach after permission and geometry readiness. Update on throttled scrolling, approved resizing, and bounded visible-time ticks. Emit cumulative `progress` at 5-percentage-point reach changes or at most every 10 visible seconds, plus a best-effort hidden flush.

Use monotonic `max` when merging cumulative values for a segment; never add cumulative `visible_ms` from multiple events. Do not compute denominators only from visitors who happened to scroll. Include initial tracked segment exposure and display incomplete measurement coverage separately.

### 13.3 Section and CTA exposure

Observe only registered IDs. Define an ordinary CTA exposure as at least 50% of the element intersecting the viewport for at least 1000 continuous milliseconds while the document is visible. Pause/reset appropriately when hidden or below threshold. For tall sections, use an explicitly documented viewport-relative threshold rather than an impossible 50%-of-element requirement.

IntersectionObserver supports asynchronous intersection tracking, but geometric intersection alone does not prove visual attention or absence of an occluding overlay. Suppress events for known modal/covered states and label the metric `qualified viewport exposure`, not `attention`. [R15]

Exposure events contain cumulative qualified time and an idempotent first-qualified marker. The processing layer deduplicates by view/segment/element and merges maxima for cumulative durations.

### 13.4 CTA metrics

Define and show these separately:

```text
page activation rate = distinct tracked views with approved CTA activation
                       / distinct eligible tracked page views

exposed-view activation rate = distinct exposed views with CTA activation
                               / distinct tracked views with qualified CTA exposure

click count = pointer clicks, including repeated clicks
activated views = distinct views with the action, never sum(click count)
```

Prioritize a bounded immediate send for an approved CTA click while its public context is still eligible, without delaying navigation. If the host immediately becomes ineligible, the required queue discard can lose an unsent CTA event; never bypass the privacy gate to recover it. Treat these as observed activations, not a guaranteed business-event ledger. Clicks before the exposure-duration threshold still count toward page activation rate. Do not put them in the numerator of exposed-view rate unless the view also met its exposure requirement; use the intersection of the two sets. A successful registration cannot be inferred from a Register button click.

Release one tracks `registration-start` only as an approved semantic action. Completed registration, deposits, and financial events require a separate approved event contract and source integration; they are not implemented by guessing from URL changes.

Heuristics such as repeated clicks or suspected dead clicks may be experimental overlays later. Do not label a click dead solely because the URL did not change; modal, async, and SPA behavior make that inference unreliable.

---

## 14. Custom heatmap rendering

### 14.1 Required implementation

Implement `packages/heatmap-renderer` from our own source. It accepts already authorized aggregate points plus reference metadata; it never queries a live customer page or reads a visitor DOM.

Provide pure functions:

```ts
projectPoint(point, sourceGeometry, referenceManifest): ProjectionResult;
binPoints(points, grid): Float32Array;
buildGaussianKernel(radius, sigma): Float32Array;
convolveGrid(grid, width, height, kernel): Float32Array;
normalizeDensity(density, scale): Float32Array;
colorizeDensity(density, palette, opacity): Uint8ClampedArray;
renderTile(canvasContext, rgba, tileGeometry): void;
```

Add unit/property tests for every numerical function. The rendering layer must be replaceable without changing event collection or database schema.

### 14.2 Numerical model

Project only compatible points. Add nonnegative point weights to a bounded grid, normally one cell per 4 CSS pixels. Convolve with a separable Gaussian kernel. Normalize the kernel so its sum is one; document edge truncation. Suggested starting visual parameters are sigma 8 CSS pixels and radius 24 CSS pixels, with units preserved under zoom.

For a log display scale:

```text
intensity = clamp(log(1 + density) / log(1 + scale_max), 0, 1)
```

Handle `scale_max=0` by rendering full transparency. Colorize through a documented palette with a visible numeric legend. Do not use arbitrary alpha-overdraw as an undocumented count estimator.

Default weights are observed click counts, not sampling extrapolations. Offer `clicks per 100 tracked views` as a separately labeled normalization. The smoothed density is for visualization; counts and rates come from exact aggregate tables, not from pixel colors.

### 14.3 Comparison mode

Comparing two revisions or campaigns requires common filters, consistent sample interpretation, compatible geometry, and a shared numeric scale. Independent auto-scaling can make a low-traffic map look as intense as a high-traffic one. Provide an explicit shared-scale toggle and show both denominators.

Never average percentages without denominators. Never describe a visual difference as statistically significant without an actual pre-specified statistical analysis.

### 14.4 Canvas and export limits

Use tiled rendering for long pages; do not allocate a 100000-pixel-high full-resolution canvas. Starting tile size is 1024 by 1024 backing pixels with a bounded cache and an export pixel budget. Display coordinate math in CSS pixels, then scale backing storage by a capped devicePixelRatio for crisp output.

Use a Web Worker for numerical aggregation when supported, with a tested main-thread fallback. Do not require OffscreenCanvas support for core use. Cancel stale work when filters change; prevent an older request from overwriting a newer view.

Render the reference image from the authenticated same-origin storage route. If an image is imported from a different origin, handle CORS explicitly; do not break export by drawing an untrusted remote image onto the canvas.

PNG exports must include the site/page, reference revision, dates/timezone, device geometry, sample rate, denominator, scale, mapped coverage, and a `sampled observations` label. CSV exports contain aggregate rows only and neutralize spreadsheet formula injection in textual columns.

---

## 15. Reference screenshots and layout manifests

### 15.1 Two capture paths

Provide manual import first: the operator uploads an approved PNG/WebP plus a validated manifest. This makes the core product usable when automated capture is blocked by company infrastructure, authentication, geo rules, or an unverified sandbox. Manual images must be public-page references without customer data, not screenshots from a logged-in session.

Provide an isolated Playwright capture runner for approved selected pages and local fixtures. Reconstruct the capture URL with the registered rendering selectors, and validate the resulting page identity; the Halloween reference must not silently use `/casino/` without `lp=halloween`. The operator selects a registered page/revision/viewport, not an arbitrary URL typed into a public endpoint. A capture failure must never trigger disabling TLS verification, bypassing site controls, or logging into a player account.

The official Playwright Docker guidance distinguishes trusted tests from browsing untrusted content and warns that root execution disables the Chromium sandbox. Use a non-root, sandboxed, restricted capture design; do not treat an off-the-shelf test container as an adequate production security boundary. [R07]

### 15.2 Manifest contract

```ts
interface ReferenceManifestV1 {
  schema_version: 1;
  site_id: string;
  page_key: string;
  revision: string;
  locale: string;
  variant: string;
  state: string;
  captured_at: string;
  viewport: { width: number; height: number; dpr: number };
  document: { width: number; height: number };
  image: {
    object_key: string;
    sha256: string;
    pixel_width: number;
    pixel_height: number;
    css_to_image_scale: number;
  };
  layer: 'document' | 'fixed' | 'element-only';
  elements: Array<{
    id: string;
    rect: { x: number; y: number; width: number; height: number };
    layer: 'document' | 'fixed' | 'sticky' | 'element-only';
  }>;
  masks: Array<{ x: number; y: number; width: number; height: number }>;
  capture_policy_version: string;
  capture_status: 'pending-review' | 'approved' | 'rejected';
}
```

Do not store page HTML, arbitrary selectors, content text, network response bodies, authenticated cookies, or browsing credentials in the manifest. Approved element IDs and geometry are sufficient.

### 15.3 Capture procedure

The runner starts a fresh unauthenticated browser context with an approved locale, fixed viewport, and deterministic preference settings. No user's browser profile is mounted. Wait for the page's explicit readiness signal, registered fonts/images, and a bounded stabilization period. Do not rely on `networkidle` indefinitely on sites with live connections.

Use a maximum capture duration and navigation count, bounded page length, one local capture at a time, and a policy controlling animations/carousels. Prefer an owner-provided deterministic preview state. Do not automatically click through cookie banners, account dialogs, offers, or gameplay flows to obtain a prettier reference.

Mask private regions before rasterization and check the final image before approval. Consent-banner state must be controlled and recorded; never mix banner-obscured and unobscured geometry silently. For document captures, fixed overlays are hidden using visibility-preserving rules and stored in a separate viewport reference when supported. Complex sticky behavior is element-only unless a deterministic capture is validated.

PNG is the simplest canonical format. An image importer decodes and re-encodes accepted PNG/WebP, removes metadata, verifies image dimensions, caps total pixels and file size, and rejects SVG, HTML, polyglots, unsupported types, and decompression bombs. Suggested upload caps are 20 MiB compressed and 40 megapixels decoded, subject to load testing.

### 15.4 SSRF and runner containment

All outbound requests, redirects, subresources, DNS resolutions, and browser background connections must be constrained to an approved set of page and static-asset hosts. Reject non-HTTPS URLs outside the isolated demo fixture profile, userinfo, unexpected ports, IP literals, redirects to unauthorized hosts, and destinations resolving to loopback, private, link-local, multicast, or cloud metadata addresses. Validate connection destinations, not just the original string, and account for DNS rebinding. [R16]

Browser request interception alone is not a complete network sandbox. Use an enforceable network/egress proxy or equivalent container/VM policy, including IPv6, DNS, redirects, WebSockets, service workers, and direct UDP/WebRTC paths. Block or disable unsupported transports. The capture worker has no route to the database or management network, no cloud credentials, no host filesystem mount beyond its job volume, and no Docker socket.

A dedicated local fixture exception may allow the demo service on its own isolated network. It must not enable arbitrary RFC1918 browsing or carry over to production capture.

When this isolation cannot be verified on the chosen host, disable remote automatic capture and use manual imports. Do not report the capture feature as production-approved while its containment tests are missing.

---

## 16. Collector API and abuse controls

### 16.1 Public route allowlist

| Method | Route | Result |
| --- | --- | --- |
| `GET` | `/sdk/v1/tracker.<version>.<hash>.js` | Immutable reviewed tracker artifact |
| `GET` | `/v1/config/:siteKey` | Legacy schema-v1 response; disabled/upgrade-required for selector-dependent properties |
| `GET` | `/v2/config/:siteKey` | Selector-aware schema-v2 public configuration for approved origins/pages |
| `OPTIONS` | `/v1/events` | Explicit browser preflight response |
| `POST` | `/v1/events` | Validated bounded ingestion |
| `GET` | `/healthz` | Generic availability only, no internal details |

Everything else returns `404` at the public gateway, even if the backend also has a similarly named private route. No `/api`, `/admin`, `/metrics`, `/debug`, `/docs`, `/screenshots`, directory listing, or database console. Private readiness and metrics are on the internal network only.

The SDK file contains no secret. Serve it with a correct JS content type, immutable cache policy, `X-Content-Type-Options:nosniff`, no cookies, and cross-origin headers compatible with SRI loading. Dynamic configuration has a short cache lifetime; never serve secrets, user lists, private notes, or backend URLs in it.

### 16.2 Configuration freshness and kill switch

Public config is scoped to the site's exact approved origin and includes only permitted selected-page keys/revisions, exact selector policies, registered IDs, sampling, bounded feature flags, and schema/config versions. The new SDK uses `/v2/config/:siteKey`; selector-dependent properties receive only a schema-v1 `enabled=false` response on the legacy `/v1/config/:siteKey` route. Never upgrade an old path-only client by silently discarding selector rules. Configuration responses must vary/cache by route, origin, site, and policy version so an enabled v2 response cannot leak into the legacy cache. Use ETags and at most a 60-second client freshness period. Refresh only while consented, eligible, and visible; on an expired configuration that cannot be refreshed, fail closed for new events.

A page kill disables acceptance for that selected page without affecting siblings; a site kill disables its whole property. Both apply regardless of the client's cached config. Server-side ingestion checks the current enablement and approval policy inside the transaction boundary; requests already committing at the moment of disable may complete. The UI must not promise recall of previously accepted events.

If a server response disables the site, clear the queue and stop the active view. Do not keep retrying disabled batches. Re-enablement occurs through a fresh lifecycle/config check, not by replaying old queued data.

### 16.3 CORS and request controls

For event requests require an exact allowed `Origin`, and verify it belongs to the `site_key` and page. Reply with that exact origin, not `*`, and `Vary: Origin`. Allow only required methods and headers. Do not enable credentialed CORS for the public collector. Reject absent or `null` origins in public browser ingestion; server-to-server integrations need a separate, authenticated endpoint later. [R13]

Static SDK assets may use `Access-Control-Allow-Origin: *` because they are public immutable code with no credentials; this does not authorize ingestion from arbitrary sites.

Origin checks are useful against accidental cross-site collection and browser abuse, but non-browser clients can forge headers and copy public site keys. Never call the collector endpoint authenticated. Apply layered controls: request-size/depth caps, per-site quotas, global concurrency limits, bounded transient source buckets, per-view event ceilings, rate limits, and anomaly alerts. A determined actor can still pollute public browser analytics.

Do not trust arbitrary forwarded IP headers. Configure trusted proxies explicitly. In multi-replica production, enforce shared limits at the approved edge and/or use an atomic site-day quota in PostgreSQL; a per-process map is not a global quota.

### 16.4 Validation order

1. Gateway method/path/body-size/concurrency limits.
2. Parse MIME and bounded JSON; reject compressed request bodies unless bounded decompression has been deliberately implemented.
3. Validate repository-owned schema, with no untrusted dynamic schemas.
4. Resolve site and verify origin, environment, specific selected page, page enablement/approval, release, and selector-aware configuration compatibility. Raw visitor URLs are deliberately absent; do not claim their independent verification.
5. Validate geometry, timestamps, identifiers, and registered field values.
6. Canonicalize/harden the accepted event object and compute its dedupe hash.
7. Begin durable transaction; enforce current site policy, view context, quotas, and idempotency.
8. Persist new events and an outbox job; commit.
9. Return `204`, with no payload echo.

A batch with any invalid event is rejected as a unit. This keeps retry semantics explicit. A duplicate identical event is not invalid. Malformed traffic increments aggregate reason counters without storing the payload.

---

## 17. Database schema and durable ingestion

### 17.1 Core tables

| Table | Purpose | Main integrity rule |
| --- | --- | --- |
| `brands` | Configurable organization/brand labels | Unique registry key; not a visitor identity |
| `domain_groups` | Explicit domain root and assigned market metadata | Unique brand/root; no implicit host authorization |
| `site_families` | Configurable parent/go/casino/sport classification | Unique safe code; extensible without SDK changes |
| `sites` | Exact-origin property, registry links, and public key | Unique key; per-property approval and permissions |
| `site_origins` | One exact candidate/approved origin per property | Unique site and unique origin within the deployment registry |
| `page_groups`, `page_group_members` | Explicit cross-property comparison mapping | Composite site/page foreign keys; never a geometry merge |
| `pages` | Selected page registry, independent approval and enablement | Unique site/page key; path is NOT unique |
| `page_selectors` | Approved exact path/query selection policy | One current selector per page; no duplicate or overlapping active target selectors |
| `page_releases` | Revision/locale/variant/state registry | Composite site/page ownership |
| `element_registry` | Approved safe IDs and roles | IDs belong to a page/release |
| `view_registry` | Immutable view context and analytical UTC day | Unique site/view ID |
| `event_receipts` | Global-within-site dedupe across event partitions | Primary key site/event ID |
| `events_raw` | Validated raw events | Range partitioned by server receipt timestamp |
| `ingest_jobs` | Durable processing work for accepted event refs | Lease/attempt state; bounded size |
| `processed_jobs` | Job application ledger | Unique job/aggregation version |
| `view_facts` | One analytical record per tracked view | Unique site/view ID |
| `segment_facts` | Geometry-specific progress and coverage | Unique site/view/segment |
| `segment_element_facts` | Cumulative element exposure per geometry segment | Unique view/segment/element/version |
| `view_element_facts` | Exposure/actions per view and element | Unique view/element with context |
| `view_action_facts` | Distinct approved action membership per view | Unique view/action/version across all CTA elements |
| `heatmap_cells` | Aggregated click bins and counts | Full cohort + layer + cell key |
| `daily_metrics` | Exact daily counters and denominators | Full approved analytical grouping |
| `references` | Private image metadata and manifest | Immutable hash; review status |
| `users`, `user_sessions`, `site_memberships` | Dashboard identity/access | Server sessions; site-scoped permissions |
| `audit_log` | Administrative actions | Append-only for normal app role |
| `export_jobs`, `deletion_jobs` | Durable control-plane operations | Idempotent job execution |

The reference DDL in section 35 establishes core constraints. Codex must implement the remaining tables, role grants, indexes, and migrations, not replace the database with a single unrestricted JSON table.

### 17.2 Transactional ingestion algorithm

Use one checked-out database connection for the entire transaction:

```text
BEGIN
  read/lock site policy consistently with enable/disable operations
  validate current origin, page approval, quota policy
  insert view_registry if absent
  verify existing view has identical immutable page/revision/consent context
  for each event in a deterministic ID order:
    attempt insert event_receipts(site_id,event_id,payload_hash,...)
    if conflict: verify existing hash matches; otherwise reject transaction
    if newly inserted: add event to accepted-new set
  increment site-day event quota by accepted-new count atomically
  insert events_raw only for accepted-new set
  insert ingest_jobs with exact new event references when set is nonempty
COMMIT
return 204
```

A hash covers the canonical event plus its immutable view context, not the batch ID or server receive time. It must remain identical when the same event is moved into a different retry batch. Handle concurrent duplicate submissions deterministically and retry serialization/deadlock failures at a bounded server level.

Dedupe receipts are inserted in the same transaction as events. If the database fails, none of the dedupe claim, raw event, quota increment, or job remains committed. Do not acknowledge first and enqueue into process memory afterward.

A local or production outage that prevents durable acceptance returns `503` with a bounded retry hint. Do not return `204` while discarding legitimate events due to an internal failure.

### 17.3 Partitioning and duplicate protection

Partition raw events by UTC server receipt time, typically daily at higher volume or monthly at low volume. Create partitions ahead of time and alert on missing partitions. Retention tooling checks for unprocessed jobs before detaching/dropping old partitions.

PostgreSQL partitioned-table unique constraints must include partition keys; a unique `event_id` on the parent alone is not a cross-partition dedupe guarantee. Maintain the separate non-partitioned or appropriately hash-partitioned receipt table keyed by `(site_id,event_id)`. [R17]

Keep receipts for seven days, longer than the maximum accepted event delay and retry window. Expire receipts only after those acceptance windows prevent legitimate replay into a new partition. Uniqueness beyond that window is not a promise; long-term analytics integrity relies on bounded accepted timestamps and view lifecycle rules too.

### 17.4 Database permissions

Migrations use a separate owner account. The collector role can read approved configuration and insert/update only ingestion-related tables; it cannot read dashboard users, password hashes, exports, or screenshot bytes. The worker can read raw events and write facts/rollups/jobs. The management role has explicit application grants and cannot become a database superuser. Runtime credentials are never shipped to the dashboard or tracker.

Every application query is site-scoped after authorization. Use composite foreign keys including `site_id` where records could otherwise cross-link properties. Row-level security can add defense in depth if implemented with reliable per-transaction context and non-bypass roles; do not claim RLS protection merely because a policy exists while the runtime uses the table owner.

---

## 18. Processing, rollups, and analytical correctness

### 18.1 Worker job model

Workers claim bounded jobs using a lease and `FOR UPDATE SKIP LOCKED`. Record `attempts`, `locked_until`, `worker_id`, `next_attempt_at`, and a non-personal last-error code. Recover expired leases after crashes. Retry transient failures with jitter; move exhausted jobs to an inspectable failed state without logging the event body.

Read required raw rows, calculate a deterministic delta, then apply the delta and the `processed_jobs` ledger entry in the same database transaction. Lock/verify the current job lease when committing so an expired worker cannot race its replacement. A unique job/version ledger prevents double application after a crash or ambiguous commit.

For mutable view facts, use idempotent upserts and field-specific merging, not blind increments. Record an `aggregation_version`; a rebuild writes a new version in shadow tables and compares before atomically switching the active version.

### 18.2 Out-of-order events and missing starts

Browser batches may arrive out of order. A click arriving before `page_view` creates a pending view fact with `has_page_view=false`; it does not silently create a denominator and call it a confirmed page view. When the start arrives, promote it exactly once. Exclude unresolved orphan views from default behavioral maps and rate calculations and show their count as coverage loss. Keep their unpromoted per-view contributions separate. When the start arrives, promote those contributions atomically exactly once; later jobs apply only their own new contributions. Do not let orphan clicks inflate a map whose denominator contains only confirmed views.

A duplicate `page_view` with a different event ID for the same view does not add another page view. A duplicate segment start similarly does not add another segment. Merge progress and exposure using maxima of cumulative values. Use sets/unique rows for actions and first-exposure flags. Two genuinely different pointer click IDs count as two clicks, even on the same button.

### 18.3 Analytical cohort

Cohort identity includes site, registered page, revision, locale, variant, state, view-start UTC date, coarse campaign, sample rate/config epoch, and geometry compatibility where relevant. Keep these dimensions bounded by registries. Do not allow arbitrary selector, URL, or campaign values to generate unbounded cardinality.

Heatmap points remain independent of a particular screenshot so a new compatible reference can render historical data. Store document bins by geometry cohort and element-relative bins by element/context. Rendering associates an approved reference at query time, with compatibility checks.

### 18.4 Denominator rules

A default whole-page rate uses distinct confirmed sampled views in the selected cohort. A viewport-segment report uses distinct segment keys and clearly says so. Do not add segment counts and label the result page views. A resized view may legitimately appear in more than one geometry cohort, so totals across those cohorts are not additive.

Assign a view to its original normalized UTC start date. Late events update that date's facts. Daily counts can then be summed for complete UTC-day filters without double-counting that view, provided the query does not overlap incompatible dimensions.

The UI may display timestamps in Bucharest time, but default aggregate date boundaries are UTC and must be labeled. A user-local calendar-day filter requires exact timestamp filtering over retained facts/raw data or a separately rebuilt timezone-aware aggregate; do not pretend a shifted UTC daily counter is exact. For expired raw/fact intervals, disable unsupported arbitrary-time filtering instead of fabricating precision.

Store numerator and denominator counts together. Date-range rates are recomputed from summed appropriate counts, never the arithmetic mean of daily percentages. Exposure/action set intersections require view-level facts until finalization, not just daily independent counts.

### 18.5 Data freshness and finalization

Show `data_through`, `processed_through`, job lag, orphan count, late-arrival policy, and aggregation version. Recent reporting remains provisional until view lifetime plus maximum lateness has passed, initially 48 hours after the last applicable view-start window. A later correction or rebuild is versioned and auditable.

Pure aggregate rows may outlive view facts. State clearly which queries and corrections remain possible after fact retention expires. Do not promise exact historical reprocessing once the underlying evidence has been deleted.

### 18.6 Minimum sample and suppression

For real data, suppress narrow cohort reports with fewer than 20 confirmed tracked views by default; the privacy owner may require a different threshold. Disable arbitrary high-cardinality slices and raw point downloads. Support a minimum cell count threshold where needed for pixel maps and apply consistent suppression to exports.

This is a disclosure-risk control, not a mathematical anonymization guarantee. Administrators cannot casually bypass it for customer events; a local synthetic demo may be exempt and visibly labeled. Keep access logs for exports and configuration changes.

Do not extrapolate total visitors automatically. A heatmap covers consented, selected, successfully collected views; it excludes people who declined, blocked the script, lost connectivity, or were outside sampling. Any weighted estimates later require explicit rate handling and separate labels.

### 18.7 Portfolio metrics without cross-domain identity

An organization/domain-group/market/family overview resolves its filters to a bounded set of sites the caller may access. Perform that authorization before querying, caching, export generation, pagination totals, or suppression. A group label does not confer site access. Users must not learn restricted site names, counts, errors, or activity through a portfolio endpoint. Shared caches must be keyed by the effective authorized site set and policy/registry versions, or be private per user. Recheck permissions when an export job executes and when its output is downloaded.

Sum distinct tracked page views **within each site**, then sum those counts across compatible, disjoint reporting cohorts. Label the result `Tracked page views across selected sites`, never `Unique visitors`. A person navigating from go to casino can generate two views and remains intentionally unlinked. Do not synthesize a cross-site conversion rate, attribution journey, or registration completion from those views.

Calculate a combined action rate only when the selected sites explicitly map the same versioned action and denominator definition, use comparable eligibility/consent rules, and have compatible sample rates/config epochs. Return the summed numerator and denominator and compute their ratio, not the mean of site percentages. Otherwise show separate site rows and mark the combined rate unavailable. Do not extrapolate a full-portfolio rate from uneven sampling. Apply disclosure suppression consistently to totals, breakdowns, and exports; do not permit differencing a hidden site/cohort through narrow filters.

Property-specific heatmap/reference APIs always require a single site ID. Portfolio comparisons display separate maps with independent dimensions and denominators. No group query can remove site from heatmap cell keys, cache keys, object ownership, or authorization checks. A shared screenshot hash may deduplicate storage bytes internally, but it never shares access permissions or makes another site's manifest compatible.

---

## 19. Private dashboard and management API

### 19.1 Navigation

Use a clean utility-focused interface led by Landing Pages and Add landing page URL, followed by Heatmaps, Comparisons, References, Installation, Data Quality, and Settings. Put optional Portfolio, Domain Groups, and origin Properties management under an advanced section; do not force a domain-wide setup wizard. Provide server-validated filters for brand, market/domain group, family, and exact origin, followed by property-specific page/release/device/date selectors. Prefer readable tables and filters to decorative charts. The UI can show NetBet's name as the target organization, but do not invent an approved brand design or logo.

The default header shows environment and collection status prominently: `LOCAL / SYNTHETIC`, `STAGING`, or `PRODUCTION`. No synthetic chart is allowed to masquerade as live traffic.

### 19.2 Screens and acceptance behaviors

| Screen | Required content |
| --- | --- |
| Portfolio | Authorized site rows and compatible totals; brand/market/domain/family filters; coverage and sample labels; no unique-user claims |
| Domain groups | Configurable domain roots, market labels, family inventory, disabled candidate import, archive, integration status |
| Property setup | Supporting exact-origin configuration; selected-page scope by default; owners, approvals, quotas, privacy controls, public key; no mandatory parent-host setup |
| Landing pages | Add URL, parsed selector preview, explicit inclusions/exclusions, independent enable/pause, optional product label, deployment verification |
| Page details | Origin/path/query identity, revisions, state/locale/variant matrix, reference coverage, missing element IDs; no mixed-campaign map |
| Heatmap viewer | Screenshot, layer selector, click/scroll/element modes, opacity, scale, zoom, mapped/excluded counts |
| Comparison | Two cohorts, shared legend scale, independent denominators, compatibility warnings |
| References | Upload/capture requests, manifest validation, approval, version and capture-policy history |
| Installation | Generated artifact/SRI/CSP instructions, health checks, rollback package |
| Data quality | Rejection counts by reason, orphan views, missing references, lag, volume anomalies |
| Exports | Authorized aggregate PNG/CSV jobs, expiry, audit trail |
| Settings | Users, memberships, retention approval, backup status, kill switches |

Every screen has loading, empty, failure, permission-denied, suppressed, stale-data, and offline states. Never show zero when a query failed; zero is data, not an error fallback.

### 19.3 Management routes

All routes live behind the dashboard's same-origin `/api` proxy and require authentication except the login bootstrap endpoints. Generate OpenAPI for at least:

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/auth/csrf
GET    /api/brands
POST   /api/brands
PATCH  /api/brands/:brandId
GET    /api/domain-groups
POST   /api/domain-groups
PATCH  /api/domain-groups/:groupId
POST   /api/domain-groups/:groupId/archive
GET    /api/site-families
POST   /api/site-families
POST   /api/registry/import-plan
POST   /api/registry/import-disabled
GET    /api/portfolio/metrics
GET    /api/page-groups
POST   /api/page-groups
PATCH  /api/page-groups/:pageGroupId
GET    /api/sites
POST   /api/sites
GET    /api/sites/:siteId
PATCH  /api/sites/:siteId
POST   /api/sites/:siteId/archive
POST   /api/sites/:siteId/disable
POST   /api/sites/:siteId/approve
GET    /api/sites/:siteId/pages
POST   /api/sites/:siteId/pages
PATCH  /api/sites/:siteId/pages/:pageKey
POST   /api/sites/:siteId/pages/:pageKey/approve
POST   /api/sites/:siteId/pages/:pageKey/disable
GET    /api/sites/:siteId/pages/:pageKey/install
POST   /api/landing-pages/preview
POST   /api/landing-pages/import-plan
POST   /api/landing-pages/import-disabled
POST   /api/sites/:siteId/releases
GET    /api/sites/:siteId/install
GET    /api/sites/:siteId/metrics
GET    /api/sites/:siteId/heatmaps
GET    /api/sites/:siteId/quality
GET    /api/sites/:siteId/references
POST   /api/sites/:siteId/references/import
POST   /api/sites/:siteId/references/capture
POST   /api/sites/:siteId/references/:referenceId/approve
GET    /api/sites/:siteId/references/:referenceId/image
POST   /api/sites/:siteId/exports
GET    /api/sites/:siteId/exports/:exportId
POST   /api/sites/:siteId/deletion-jobs
GET    /api/operations/health
GET    /api/audit
```

Landing-page preview/import endpoints accept bounded, sanitized registered selector proposals, not arbitrary visitor URLs or remote-fetch commands. Parse pasted addresses privately in the UI, show a safe preview, and send only approved constants on save; never log the original input. A page mutation enforces site membership, server-side policy validation, CSRF, audit, and page-level enablement. Site install export must require an explicit nonempty page selection and must not broaden to all routes.

Use cursor pagination and allowlisted filters/sort keys. Limit date spans, result counts, rendered cells, query duration, export size, and concurrent requests. Query timeout is not a reason to bypass property authorization.

### 19.4 UI technical requirements

Use accessible labels, keyboard navigation, focus management, semantic tables, numeric legends, and adequate contrast. Critical status must not rely on color alone. Store dashboard preferences locally only if they contain no customer events or secrets. Do not persist raw event datasets in browser storage.

Authentication, permissions, and configuration validation run on the server, not only in React. Client-side routing must not make a public endpoint out of a screenshot or export.

The dashboard may poll data quality every 15 seconds while visible. No WebSocket/SSE dependency is required for release one. A paused local collector is shown as unavailable without breaking analysis of already stored data.

---

## 20. Authentication and authorization

### 20.1 Local does not mean unauthenticated

Require a local administrator created through an interactive CLI, with no default password or public registration route. Bind the UI to loopback and validate expected Host/Origin values to reduce DNS-rebinding and cross-origin attacks against local services.

Use a maintained password-hashing implementation with Argon2id and parameters meeting the current OWASP baseline, then benchmark an appropriate work factor on the target server. Do not implement hashing yourself. [R18]

Use opaque random server-side sessions; store a hash of the session token in the database. Rotate on login and privilege changes, support immediate revocation, idle expiry, and absolute expiry. Do not store JWTs or API secrets in localStorage.

### 20.2 Cookies and CSRF

Use host-only session cookies, `HttpOnly`, `SameSite=Strict` or a justified alternative, and `Secure` for HTTPS deployments. The loopback HTTP development profile may require a explicitly documented non-Secure development cookie, but production startup rejects that configuration. Never set `Domain=.netbet.ro` or share management cookies with the collector.

Implement CSRF tokens for state-changing authenticated requests and verify expected request origins. Login also needs a CSRF/login-forgery defense. Do not rely on CORS alone. [R19]

Rate-limit login, use generic failures that do not enumerate accounts, and audit admin creation, login failures, role changes, site enablement, exports, and deletion operations without storing passwords or sensitive payloads.

### 20.3 Roles

| Role | Permissions |
| --- | --- |
| Owner | Users, approved properties, all operations, critical configuration |
| Administrator | Site settings and references within assigned sites; no unilateral privacy-policy override |
| Analyst | View approved aggregate reports; export where separately granted |
| Installer | View installation instructions and synthetic diagnostics for assigned sites |
| Viewer | Read approved reports only; no exports by default |

Use a `site_memberships` table and explicit permission checks for every resource. The owner role can see all sites only by deliberate policy. Domain groups and site families are filters, not implicit grants. Creating a new property grants nothing to users of its sibling/parent properties. Apply membership checks to portfolio counts, group listings, comparisons, references, caches, background exports, and downloads as well as site routes. Analysts cannot change sampling or turn on new pages. Installer access does not include customer event inspection.

Before remotely exposing the management UI, integrate a company-approved OIDC provider with MFA or an approved equivalent access layer. No identity-provider details are assumed in this document. Local accounts remain for development and tightly controlled recovery, not a substitute for organizational access review.

---

## 21. Marketing installation runbook

### 21.1 What Marketing receives

Generate one landing-page-scoped handoff, optionally bundling selected pages on an origin, containing the property name and approved origin, exact path/query selectors, included and excluded URL examples, versioned script URL, SRI hash, verified consent bridge, host eligibility requirements, approved element ID map, CSP changes, validation steps, release date, owner, and rollback instructions. The public site key is not a credential.

Marketing may deploy through an authorized CMS/template or tag manager only where its permissions and the site's security policy allow. A generic Custom HTML tag is not automatically consent-aware. Do not assume Google Tag Manager is present or that a Google consent flag automatically controls a custom tag; the actual CMP/tag integration must be tested.

The installer should not need to run the database or dashboard. The platform owner operates the backend. Marketing still needs the website team's help for consent, CSP, route eligibility, and stable semantic element attributes where these are not available in the CMS.

### 21.2 Site-specific release sequence

1. Add the selected landing-page URL and only its required origin property; keep both disabled. Confirm final destination, exact path, rendering query values, and neighboring URLs that must remain untracked.
2. Obtain technical/privacy approval; identify the CMP and public-context adapters; approve retention and hosting.
3. Add stable `data-hm-id` attributes and private-region exclusions to one staging page.
4. Capture/import and approve the reference for each supported revision/viewport/state.
5. Generate the release-specific SDK artifact and installation bridge; configure script and connection allowlists.
6. Test denied, granted, revoked, duplicate install, query-only campaign changes, removal/duplication of lp, exit to a parent site, mobile layout, blocked collector, and offline behavior on staging. Prove no SDK/config/events traffic on unselected pages.
7. Enable an approved limited pilot on one public landing page with an explicit sampling rate and quota.
8. Compare manual test actions with received/processed metrics; review performance and payloads for leakage.
9. Expand page by page after reviewing evidence. Do not enable entire casino/sport applications with a wildcard.

### 21.3 Content Security Policy and headers

The page's CSP must allow the reviewed SDK source in the appropriate `script-src` policy and the collector in `connect-src`. `connect-src` applies to browser network APIs including fetch and sendBeacon. Coordinate with the CSP owner; do not replace the site's whole policy with a permissive example. [R20]

Use an external same-origin consent bridge or the site's existing nonce/hash scheme. Do not recommend `unsafe-inline` or `unsafe-eval` for convenience. SRI hashes must match the immutable script bytes. Configure cross-origin resource headers for SRI loading and ensure a CDN does not rewrite the artifact after hashing.

Public collector responses must not set cookies. Review `Referrer-Policy` on the loader and fetch calls. The collector must not accidentally redirect POST requests to the dashboard, a login page, or a different hostname.

### 21.4 Browser verification checklist

With consent denied, Network shows no SDK/config/events calls under the recommended gated loader, and storage contains no tracker identity. Granting consent downloads one SDK, fetches config, and starts one sampled view. A known CTA produces one pointer click plus at most one declared semantic activation. Scrolling creates bounded progress events. Withdrawal stops all future collection and clears unsent queues.

Inspect actual request bodies on synthetic fixtures and verify no page text, input values, full URLs, cookies, tokens, or account data. Confirm CSP errors, rejected origins, layout mismatches, and missing references have clear diagnostics. A disabled collector must not block the user's page interactions.

### 21.5 Rollback

For a one-campaign rollback, use that page's collection kill switch and verify siblings remain unchanged. For an origin-wide incident, use the site's collection kill switch; it stops new acceptance after the policy change takes effect at the ingestion boundary. Then disable the tag or remove the template inclusion, deploy rollback, and verify network silence. Restore the previous immutable artifact only when its protocol remains compatible and the reason for rollback does not require complete shutdown.

Keep the last two reviewed tracker releases available for rollback. Never silently swap bytes behind a versioned SRI URL. Record rollback time, reason, affected pages, and observed collection cutoff.

### 21.6 Portfolio installation package

Allow an authorized operator to select multiple individually approved landing pages and generate a ZIP containing one install guide/config per exact origin, with an explicit selected-page subset plus a shared immutable SDK artifact reference. Include domain group, family, exact origin, site key, allowed routes, adapter version, CSP owner, reference coverage, release, consent review, health check, and rollback owner in each entry. Generate no runnable production snippet for pending/UNKNOWN properties; instead return a missing-requirements report.

A shared-template selector must map an exact serialized origin AND the approved path/query selector to a selected page configuration before loading. An exact-origin match by itself is insufficient. It cannot accept a hostname suffix, dynamically invent a property, fall back to another site's key, or borrow another origin's consent adapter. Shared SDK bytes are not shared consent or identity. Duplicate-install protection still applies separately in each document. Marketing must confirm the rendered destination and actual CMS/tag-manager deployment scope for every entry.

The optional candidate inventory is not an instruction to import or install on all 15 hosts. A single selected URL is a complete valid starting scope; parent sites are not dependencies. Choose the approved rollout set explicitly. Confirm one-origin shutdown without changing sibling properties, then confirm global emergency shutdown. Adding another domain later uses the same registry/onboarding flow, not a new copy of the platform.

---

## 22. Local-to-public collection without buying a domain

### 22.1 Stage one: no external exposure

Run the complete local stack and demonstrate tracking only on the bundled fixture. This is sufficient to build and test the project. No domain purchase is a prerequisite for implementation.

### 22.2 Stage two: optional quick tunnel for controlled testing

After the local public-boundary tests pass, an approved tester may run:

```bash
cloudflared tunnel --url http://127.0.0.1:8080
```

This exposes only the already hardened collector gateway, not the UI. Use the generated HTTPS origin as the temporary tracker endpoint on an approved test page and explicitly allow that page's origin. The collector should emit no absolute self-links, so it does not need to trust arbitrary forwarded Host headers.

Cloudflare's Quick Tunnel documentation describes a temporary hostname without requiring a domain/account, no uptime guarantee, changing hostnames, a 200 in-flight request limit, and no SSE. It is for development/testing. Confirm current terms and organizational approval before use. [R04]

The collector cannot sit behind an interactive email-login challenge because tracker requests cannot complete that human login flow. Keep the collector public but narrowly scoped and rate-limited; do not expose the private dashboard to solve that problem.

A tunnel outage, laptop sleep, ISP interruption, or restarted hostname causes tracking loss. Update the test endpoint/CSP after a hostname change and remove the old test configuration. Do not use permissive wildcard CSP entries to avoid this work.

### 22.3 Stage three: durable live ingestion, still local dashboard

Provision an approved stable HTTPS service endpoint, such as an organization-controlled subdomain or hosting-provider hostname. An always-on deployment hosts the data plane. The dashboard can remain local with a private connection to the management service.

One supported pattern is an authenticated SSH port forward for the remote management gateway:

```bash
# Pattern only. Replace with company-approved host/user/port after provisioning.
ssh -N -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:9090:127.0.0.1:9000 ops@APPROVED_REMOTE_HOST
```

The local dashboard gateway proxies `/api` to `http://127.0.0.1:9090`; for a Dockerized gateway, document the host-gateway connection or run the forwarding process in a dedicated sidecar accessible only on the management network. Do not assume a container's `127.0.0.1` is the workstation's host loopback. Enforce management login, expected Host/Origin, and CSRF checks through this path.

No read-only database port should be exposed to the internet just to feed a local dashboard. Prefer the private management API. Do not copy production customer data to a personal machine without explicit authorization.

### 22.4 Future domain purchase

A custom domain changes endpoint configuration, TLS certificates, DNS, CSP, origin policy, and installation artifacts, not the event model. A company-approved existing hostname may be preferable to purchasing a personal domain for company customer data. Keep all endpoint values in configuration rather than hardcoding them throughout the source.

---

## 23. Production deployment and migration

### 23.1 Minimum durable production topology

At a measured small scale, one approved Linux server with supervised containers and durable storage can be an initial deployment, but it has a single failure domain. Document that limitation. Higher availability requires at least redundant ingestion capacity and an appropriate database availability/backup design, not just a second stateless container on the same failing disk.

Use a dedicated public collector hostname, HTTPS termination, explicit route proxying, rate limiting, and bounded body/time limits. The database, workers, management API, and reference storage stay private. The management UI remains local or behind approved corporate access.

Run services as non-root users where supported, with read-only application filesystems, dropped unnecessary capabilities, resource limits, `no-new-privileges`, health checks, and secret files or a managed secret mechanism. The capture runner has its own stricter policy; do not accidentally disable browser sandboxing while hardening the other containers.

No Docker socket mounts, public database ports, public object buckets, shared admin/collector cookies, or secrets in frontend build variables.

### 23.2 Configuration profiles

| Profile | Main behavior |
| --- | --- |
| `development` | Loopback HTTP, demo only, verbose non-personal diagnostics |
| `staging` | HTTPS collector, synthetic data, approved staging origins, separate storage |
| `production` | HTTPS enforced, real-site approvals required, private management, no debug, backup checks |

Production startup must reject demo-only origins, placeholder secrets, permissive CORS, disabled auth, missing retention settings, public database bindings, invalid SDK hashes, and unconfigured public-page eligibility requirements.

### 23.3 Build and deploy workflow

Build once from a reviewed commit; run tests and scans; generate an SBOM and image digest manifest; apply an expand-compatible database migration; deploy collector/worker/API; run synthetic canaries; publish the immutable SDK; then update a limited page integration. Keep protocol v1 compatible with at least the immediately previous reviewed SDK for a documented transition window.

Database migrations use a lock and an explicit migration identity. Never run destructive schema changes automatically at application startup. Use expand/migrate/contract steps for breaking changes, with a verified backup and rollback or forward-fix plan.

### 23.4 Endpoint/domain migration

Provision and test the new collector before switching page snippets. Authorize both endpoints in the page's CSP during a controlled transition. An old gateway may proxy to the same ingestion backend while maintaining original event IDs; avoid double loading two trackers or sending every event to two independent databases.

If databases must move, pause writes or use a carefully tested replication/cutover plan. Preserve site keys, event IDs, view IDs, schema/aggregation versions, references, and retention deadlines. Reconcile counts, test a restore, and document the cutover watermark. Do not call a partial export an exact migration.

Remove old endpoints only after the documented compatibility/cache window. Revoke obsolete credentials and delete or retain the old data according to the approved migration policy.

---

## 24. Retention, deletion, backup, and recovery

### 24.1 Proposed starting retention

These are configurable engineering defaults awaiting owner/privacy approval, not legal retention requirements.

| Data | Starting retention | Notes |
| --- | --- | --- |
| Raw validated events | 30 days | Includes potentially linkable view IDs |
| View/segment/element facts | 30 days plus processing grace where approved | Required for exact detailed recomputation |
| Event dedupe receipts | 7 days | Must exceed acceptance/retry windows |
| Pure aggregate metrics/cells | 180 days | No view/event IDs; suppression still applies |
| Reference screenshots | 180 days or shorter page lifecycle | Public-page content only; private access |
| Generated exports | 24 hours | Operator-downloaded copies require separate handling |
| Operational logs | 14 days | No raw event payloads or identifiers |
| Administrative audit | 180 days | Staff metadata; separate access/retention decision |
| Backup snapshots | 14 days starting policy | Encrypted, separately stored, tested restore |

Do not retain a hidden raw data copy indefinitely in debug logs, retry queues, failed-job payloads, exports, or backups. Job records hold references rather than complete redundant raw payloads wherever possible.

### 24.2 Deletion procedures

Implement site-wide and date-range deletion jobs, deletion of imported/captured images, and targeted view-ID deletion where the identifier is legitimately available. Deleting a site first disables ingestion and resolves pending jobs, then removes or rebuilds related facts/aggregates consistently.

For retained raw/fact periods, a targeted deletion requires recomputing affected aggregate groups or subtracting a verified per-view contribution. Do not delete a raw row while leaving its contribution in a supposedly corrected report. Suppress affected results until rebuilding succeeds.

After per-view evidence has expired, anonymous-looking aggregate values cannot necessarily be traced back to a particular person. Do not promise exact historical targeted erasure without a feasible linkage/recomputation method. Let the privacy owner determine the required response, including full cohort removal if appropriate.

Maintain a minimal deletion ledger so restored backups do not silently resurrect deleted records. Apply outstanding deletions before a restored environment is brought back into service. Backup expiry and access controls must be included in the deletion policy.

### 24.3 Backup strategy

Local mode: an explicit backup command produces a consistent logical database backup, reference files, checksum inventory, schema version, software version, and a restore manifest in an approved destination. Encrypt using a maintained backup/encryption tool and store the key separately. Do not create custom encryption.

Production: choose a tested PostgreSQL-aware backup approach, with base backups and WAL archiving when point-in-time recovery is required. A database backup must be paired with reference/storage consistency and a restore procedure. PostgreSQL's PITR documentation is the technical reference, not proof that our deployment has it configured. [R21]

Proposed durable-production recovery targets are RPO at most 15 minutes and RTO at most 4 hours; these are targets to prove or revise, not guarantees. A nightly dump alone cannot meet a 15-minute RPO. Local demo has no availability/RPO promise.

### 24.4 Restore exercise

Restore into a new isolated environment. Verify checksums, schema version, counts, referential integrity, processed-job ledger, approved reference images, active retention policy, user access, and pending deletion replay. Keep real collection disabled during the exercise. Record measured restore time and the recovered data watermark.

The production-readiness report must include a real successful restore result. "Backup file exists" is not sufficient.

---

## 25. Security model and threat register

### 25.1 Trust boundaries

The visitor browser, page URL, public site key, event contents, uploaded images, imported manifests, and remotely loaded page resources are untrusted. Company identity-provider assertions are trusted only after proper verification. The private dashboard is not trusted merely because it runs locally; its server enforces every permission.

Protect customer interaction data, administrative credentials, deployment secrets, reference assets, and the integrity of marketing reports. Model both data leakage and data poisoning.

### 25.2 Initial threat register

| Threat | Required mitigation | Residual limitation/test |
| --- | --- | --- |
| Forged analytics | Site/origin registry, quotas, shape validation, volume anomaly detection | Public keys/Origin can be copied; synthetic forgery test |
| Duplicate events | Transactional receipts and idempotent rollups | Test retries, midnight, crashes, concurrency |
| Sensitive content capture | Collection allowlist, no text/form APIs, private regions, strict schema | Host context still needs correct integration |
| Screenshot SSRF | Network-enforced egress allowlist, DNS/IP validation, no secrets | Test redirects, IPv6, metadata, rebinding |
| Malicious reference upload | Decode/re-encode, pixel/file bounds, private storage | Fuzz parser boundary with safe fixtures |
| Cross-site report access | Server RBAC, composite ownership, optional reviewed RLS | Test every ID-bearing endpoint |
| XSS | Escape text, no unsafe HTML, CSP, safe export filenames | Test malicious display names and manifest fields |
| CSRF/local service abuse | Host/Origin checks, CSRF, loopback binds, login | Test requests from unrelated browser origins |
| SQL injection | Parameterized SQL and allowlisted sort/filter fields | No raw query strings from client |
| Denial of service | Body/depth/row/pixel/time/queue limits, quotas | Load-test actual resource envelope |
| Cookie/URL log leakage | Dedicated collector, header/body redaction, provider review | Inspect edge/proxy logs, not just app logs |
| Supply-chain compromise | Lockfile, reviewed versions, scanning, SBOM, artifact hashes | Dependency review is ongoing |
| Data loss | Durable commit before ACK, backups, restore tests | Laptop/tunnel has no production durability |
| Unauthorized live deployment | Disabled seed records, approval gates, owner-controlled release | Never auto-install onto NetBet sites |

### 25.3 Additional requirements

Do not add an admin browser SQL console, arbitrary shell command executor, remote-code plugin system, or unbounded custom JavaScript callbacks in config. Do not make the screenshot service a general web proxy.

Validate resource paths using opaque generated object keys, not user-controlled filesystem paths. Serve files only through authorized routes. Normalize and reject traversal attempts, encoded separators, and unexpected MIME types.

Secrets are generated with a CSPRNG, injected at runtime, excluded from source control, redacted in logs, and rotated after suspected exposure. Different environments use different secrets and site keys. A public site key is not placed into a secret store as though it can authenticate a browser.

Do not run intrusive scans or load tests against the real NetBet sites as part of this build. All destructive/adversarial tests run on local or explicitly approved staging fixtures.

---

## 26. Performance and capacity planning

### 26.1 Initial performance targets to measure

| Component | Initial target on documented reference hardware |
| --- | --- |
| SDK gzip size | At most 35 KiB |
| Pointer handler | p95 below 2 ms on approved fixture/device profile |
| SDK-attributable long tasks | None above 50 ms in the defined test trace |
| Collector steady load | 100 requests/second, 20 events/request |
| Collector burst | 300 requests/second for 60 seconds with bounded queues |
| Ingest latency | p95 below 250 ms at steady load after durable commit |
| Accepted-job processing lag | p95 below 60 seconds at steady load |
| Standard dashboard query | p95 below 2 seconds on seeded representative data |
| Heatmap interactions | Pan/zoom remains responsive with bounded tiles |

These are proposed acceptance targets, not demonstrated capacity or NetBet traffic estimates. Record hardware, dataset, database/storage settings, sample rate, request sizes, duration, warm-up, and error rates for each result. Revise targets via an explicit decision record if evidence requires it.

Local minimum resource settings need not meet the production test profile. Do not claim the laptop can support every NetBet property because a demo looks fast.

### 26.2 Volume worksheet

```text
eligible views/day = approved-page views * analytics-consent proportion
tracked views/day = eligible views/day * configured sample rate
events/day = tracked views/day * mean retained events per tracked view
raw payload bytes/day = events/day * measured mean serialized event bytes
DB bytes/day = measured bytes from tables + indexes + receipts + facts
```

Illustrative planning inputs, not site measurements:

```text
100000 approved-page views/day
x 0.50 assumed consent proportion
x 0.20 selected sampling
= 10000 tracked views/day

10000 tracked views x 20 events = 200000 events/day
200000 x assumed 800 bytes = 160000000 raw payload bytes/day
```

PostgreSQL storage, indexes, receipts, replicas, WAL, backups, and screenshots add overhead. Measure their actual sizes rather than assuming JSON bytes equal disk usage. At 30 days the example payload alone is 4.8 billion bytes; a storage allocation must include observed overhead and headroom.

### 26.3 Scaling strategy

Keep normal ingestion stateless except for bounded local rate counters; durable state is in PostgreSQL. Scale collectors horizontally after adding a shared edge/quota policy. Tune batch inserts, connection pools, indexes, partition maintenance, and rollup jobs before adding new databases.

Monitor the exact hot spots: receipt uniqueness writes, quota-row contention, job lag, WAL/disk throughput, long-running report queries, and storage growth. If measured volume exceeds PostgreSQL's approved envelope, an architecture decision may introduce a dedicated event store or queue later. Do not add Kafka, Redis, ClickHouse, or Kubernetes by default without demonstrated need and a migration/retention design.

Separate the capture resource budget from event processing. A stalled screenshot must never exhaust collector connections or database capacity.

---

## 27. Observability, support, and incident runbooks

### 27.1 Metrics

Expose metrics privately: requests by status/rejection reason, body bytes, accepted events, duplicate events, conflicting duplicate hashes, site quota rejections, DB commit latency, jobs pending/failed, oldest-job age, worker throughput, orphan views, clock-adjusted views, missing references, mapped coverage, database/volume utilization, backup age, and retention lag.

Avoid event/view IDs, full URLs, unbounded campaign labels, raw IPs, and user IDs as metric labels. They leak data and create cardinality problems. Use bounded site IDs only where access and retention are appropriate.

Structured logs contain request/job correlation IDs, subsystem, safe error code, duration, and release version. Correlation IDs must not be reused as persistent visitor IDs. Scrub errors originating in database drivers and HTTP clients.

### 27.2 Initial alerts

Alert on sustained elevated collector `5xx`, job age above 5 minutes, failed privacy checks, reference/capture policy failures, unexpected zero collection on an otherwise active pilot, events exceeding approved quotas, backup age beyond policy, disk above 80%, retention stalled, and schema-version rejection spikes after a release.

A "zero events" alert is not proof that customers stopped visiting; check consent changes, sampling, CSP, ad blocking, endpoint availability, page changes, and schedule first.

### 27.3 Runbooks

**Collector failure:** check gateway health, certificate, deployment change, database readiness, disk, and quotas. Return honest failures and preserve backend evidence. Do not remove consent gates to increase telemetry.

**Worker backlog:** leave accepted raw events durable, stop expensive optional jobs, inspect safe error codes, increase capacity within measured limits, and restart expired leases. Never delete the queue as the first recovery action.

**Suspected private-data capture:** disable affected sites and exports, restrict access, preserve minimal incident evidence, contact the security/privacy owner, identify affected periods, and execute the reviewed remediation/deletion process. Do not copy raw sensitive examples into tickets or AI prompts.

**Wrong heatmap alignment:** disable the affected reference, preserve counts, inspect revision/viewport/state mapping, create a corrected reference or mapping version, revalidate fixture projections, and annotate reports. Never manually move hotspots to make the picture look plausible.

**Disk pressure:** stop capture/export jobs, reduce intake only through approved sampling/quota controls, resolve processing lag, perform reviewed retention, and expand storage. Never delete database files directly.

**Compromised admin credentials:** revoke sessions, rotate affected secrets, preserve audit evidence, review exports/settings changes, restore access through the approved recovery path, and require review before re-enabling collection.

---

## 28. Testing and acceptance matrix

### 28.1 Unit and contract tests

Implement query-aware selected-page matching and all LP-01 through LP-30 cases from section 37.9, including malformed/duplicate selectors, no parent-site dependency, ignored attribution, query-only transitions, and capture identity. The first fixture must render different synthetic pages at the same path using different `lp` values.

Cover URL/origin normalization, route allow/deny precedence, privacy-safe campaign mapping, consent state transitions, lifecycle generations, sampling boundaries, event schema rejection, batch splitting, UTF-8 byte limits, queue expiry, retry IDs, duplicate install handling, numerical projections, kernel normalization, color scaling, and zero-data rendering.

Use property-based testing for finite geometry, ratio bounds, idempotent merges, and arbitrary schema input rejection. Test malicious strings without logging their values. Contracts must reject unknown nested properties rather than stripping them silently.

### 28.2 Browser fixture matrix

Run supported current Chromium, Firefox, and WebKit engines, while documenting that Playwright WebKit is not a substitute for all real Safari/device testing. Add manual smoke tests on at least one supported iOS and Android device before broad rollout.

Fixture widths: 360, 390, 768, 1024, 1366, and 1440 CSS pixels. Test DPR 1 and 2 where supported, orientation changes, zoom, fixed/sticky navigation, long and short pages, font/image delayed loads, a carousel, hidden tab, private overlay, cross-origin iframe, keyboard activation, BFCache, router navigation, and restored scroll position.

Unsupported conditions must yield explicit excluded geometry rather than a confidently incorrect map.

### 28.3 Privacy acceptance tests

| ID | Test | Required result |
| --- | --- | --- |
| P01 | Initial consent unknown/denied | No SDK/config/events traffic with gated loader; no tracker storage |
| P02 | Grant consent on eligible page | One start, no pre-consent replay |
| P03 | Revoke while fetch/init is pending | No callbacks restart collection; unsent queue erased |
| P04 | Enter login/payment/betslip overlay | Collection stops before excluded context; no form/region capture |
| P05 | Enter synthetic secrets in forms | No value/text/token in payloads, logs, exports, screenshots |
| P06 | URL contains email/token/click ID | Only registered page/campaign codes persist |
| P07 | Unknown event property injected | Entire batch rejected; value not logged |
| P08 | Capture reference includes private region | Region masked before approval; no raw HTML retained |
| P09 | Restore a backup after deletion | Deletion ledger replay removes/rebuilds affected records |
| P10 | Production build includes debug mode | Release gate fails |

### 28.4 Reliability and security acceptance tests

| ID | Test | Required result |
| --- | --- | --- |
| R01 | Identical batch sent repeatedly/concurrently | One copy of each event; one rollup contribution |
| R02 | Same event ID with modified content | Conflict rejected; no mixed writes |
| R03 | Database outage before commit | No success ACK; safe retry later |
| R04 | Worker crash before/after rollup commit | Event effects applied exactly once per aggregation version |
| R05 | Retry across UTC partition boundary | Receipt prevents duplicate raw insert |
| R06 | Missing partition | Controlled error/alert, no false success |
| R07 | Invalid or forged origin | Browser policy rejects unapproved origin; limitations documented |
| R08 | Analyst requests another site's export/image | Access denied at API/storage boundary |
| R09 | Public collector path probes `/api`, `/metrics`, `/admin` | All unavailable through gateway |
| R10 | Capture URL redirects to private/metadata IP | Network policy blocks; no internal connection |
| R11 | Malformed/huge image upload | Bounded rejection without excessive memory |
| R12 | Local browser request with hostile Host/Origin | Rejected; no management action |
| R13 | Oversized/deep JSON/compressed body | Bounded rejection, no process crash |
| R14 | Disk/connection saturation | Backpressure and honest failure; no uncontrolled queue growth |
| R15 | Previous SDK after compatible backend deployment | Contract remains supported through documented window |

### 28.5 Numerical and UX acceptance tests

Validate projections with known coordinates to within one CSS pixel before rasterization. Validate renderer tile boundaries and overlap halos so smoothing does not produce visible seams. Test that excluded sticky/zoomed data does not leak into strict document mode.

Compare exact view/action/exposure numerators and denominators against fixtures, including repeats, out-of-order delivery, resize segments, midnight, sample-rate changes, late arrival, orphan events, and suppression. Test CSV exports for formula-injection handling and correct date/scale metadata.

Run real browser E2E from fixture interaction through database processing to visible dashboard and exported PNG, not only mocked API responses.

---

## 29. CI, supply chain, and release management

Every pull request runs formatting/lint, type checks, unit/contracts, isolated database migrations, integration tests, privacy tests, core browser E2E, SDK size checks, secret scans, dependency/license review, and container builds. Expensive performance/recovery/capture isolation tests may run in a controlled release pipeline but cannot be omitted from production approval.

Pin CI action versions by immutable references where the chosen CI supports that. Do not assume an existing GitHub organization/repository or create one automatically. Keep the workflow portable, with local equivalents for all essential checks.

Protect release branches and require human review for collection fields, consent behavior, security controls, database migrations, new domains, retention, and SDK deployment. A dependency upgrade changing data capture must pass the same privacy tests as new code.

Generate a release manifest containing commit, SDK filename/SRI, container digests, schema version, aggregation version, dependency inventory, test evidence paths, known limitations, migration steps, and rollback artifacts. Do not store deployment secrets in the manifest.

Security issues marked critical cannot be waived by Codex. Record any human-approved risk acceptance, owner, scope, and expiry. An unresolved unknown is not a green check.

---

## 30. Codex implementation milestones

Work in the following dependency order. The default task is implementation, not another planning-only answer. Each milestone delivers working code, tests, and evidence. Do not attempt live deployment or edit NetBet pages without a separately authorized action.

### M0: Repository and decisions

Read this complete document, inspect the existing repository if any, and preserve unrelated work. Create `IMPLEMENTATION_STATUS.md`, `DECISIONS.md`, and a requirement/test mapping. Resolve supported dependency patches from official sources; pin them. Scaffold packages, scripts, Compose profiles, lint, strict types, and a local demo page.

**Exit:** a clean checkout builds containers, `doctor` reports meaningful results, and the implementation status distinguishes missing features from completed ones.

### M1: Contracts, schema, and durable intake

Include schema-v2 selector-aware public config, selected-page draft imports, independent page enablement, and site/page composite keys. Import only the selected-origin example by default; the legacy 15-host catalog is optional.

Implement the event/config schemas, brand/domain-group/site-family registries, exact-origin selected-page registries, the one-page disabled draft, optional host-catalog import support, safe import/dry-run, core SQL migrations, runtime DB roles, collector route boundary, origin validation, quotas, view registry, event receipts, raw persistence, and outbox jobs. Add test-only synthetic generators targeting isolated local properties, not real NetBet origins.

**Exit:** invalid events are rejected without payload logging; repeated/concurrent events persist once; database failure produces no false success; NetBet seed sites remain disabled.

### M2: Consent-safe tracker

Implement the shared local origin/path/query matcher, no-load behavior on unselected URLs, same-path query transitions with content-readiness gating, and page-specific shutdown.

Implement the state machine, loader integration against the fake CMP, host eligibility adapter, memory-only views, complete-view sampling, page/segment lifecycle, primary pointer events, non-pointer actions, progress, exposure, bounded queue, fetch transport, and teardown. Add explicit route integration first.

**Exit:** all consent/privacy tests pass on the fixture; no arbitrary DOM text or form values can reach the event serializer; duplicate install and async revocation races are covered.

### M3: Facts and metrics

Implement lease-based workers, idempotent job ledger, orphan handling, per-view/segment/element facts, click bins, exact count/rate aggregates, freshness, and aggregation versioning. Add out-of-order, midnight, resize, late-arrival, and repeated-event fixtures.

**Exit:** all metric test vectors match expected values before any visually polished dashboard is accepted.

### M4: Authentication and basic dashboard

Lead with Add landing page URL, a target list, exact selector preview, exclusion tests, and independent page status; require no parent-site setup.

Implement interactive local admin creation, server sessions, CSRF, login throttling, site memberships, domain-group/family/site/page management, portfolio filters and authorized reporting, and the disabled-site approval workflow. Build real loading/error/empty states. A new synthetic domain/property must be configurable without a source-code change.

**Exit:** owner can log in locally, see genuine local-demo data, and cannot accidentally enable a real site without required metadata; cross-site authorization tests pass.

### M5: References and custom renderer

Implement private image/manifest import, review workflow, numerical projection, custom density renderer, tiled display, scroll overlay, element-relative mode, shared-scale comparison, and aggregate exports. Build fixture reference generation. Add remote capture only with enforceable isolation.

**Exit:** known fixture clicks align within one CSS pixel pre-rasterization; mismatched layouts do not render as valid; export metadata and suppression are correct.

### M6: Installation and multi-property workflow

Export selected-page manifests and path/query-scoped host/tag instructions. Prove the requested Halloween target can be installed without including `/casino/`, other `lp` values, or parent/product sites.

Generate versioned SDK assets/SRI, per-origin and multi-property installation packages, a demo CMP bridge, CSP requirements, exact-origin/path/query shared-template selection, independent page/site refresh and kill behavior, and origin/page diagnostics. Register only selected-page origins; keep the larger catalog optional. Implement section 37.8 and 37.9 tests.

**Exit:** another developer can instrument a second authorized synthetic page using the handoff, without editing backend source or receiving database credentials.

### M7: Operational hardening

Implement retention, deletion/rebuild, backup and restore tooling, metrics/alerts, production configuration validation, immutable release manifest, safe image processing, crash recovery, and security scans. Prove the public gateway cannot reach management routes.

**Exit:** restore and worker-crash drills pass, no unbounded resource paths remain, and failed checks appear honestly in `PRODUCTION_READINESS.md`.

### M8: Approved external staging test

Document and test an optional collector-only HTTPS tunnel with synthetic traffic from an explicitly approved staging origin. Keep the dashboard local. Verify real browser CORS, CSP, SRI, failure behavior, and endpoint removal.

**Exit:** staging evidence is recorded; no claim of production uptime or permission to collect live traffic is made.

### M9: Production candidate

Produce the measured capacity report, completed threat model, data dictionary, incident runbooks, reviewed deployment plan, marketing package, and signed-off release checklist. List remaining organization-controlled approvals separately from software defects.

**Exit:** the owner can make an informed production decision. Codex does not self-approve privacy/legal/commercial permissions or deploy the integration just because local tests pass.

### Session checkpoint rule

At the end of any Codex session, state the current milestone, completed requirements, commands actually run, evidence locations, failures, unresolved decisions, and the next concrete implementation step. Do not claim the full project is complete after only scaffolding or a UI prototype. Keep partial work runnable and commit only when the repository's established workflow permits it.

---

## 31. Production release gates

**Selected-page scope gate:** LP-01 through LP-30 pass with evidence; target URLs/rendering selectors and ignored parameters are reviewed; no unwanted parent/product/campaign traffic; page kills work independently; selected-page references match the exact approved template/revision. The existence or installation of unrelated catalog hosts is NOT a release gate.

Treat each gate as `PASS`, `FAIL`, `NOT_RUN`, or `OWNER_APPROVAL_REQUIRED`. `NOT_RUN` is not a pass.

| Gate | Evidence required |
| --- | --- |
| Authorization | Owner approves each property, exact origin, route, environment, and deployment |
| Privacy | Purpose/legal review, CMP adapter, host eligibility, exclusions, retention, provider review |
| Tracker safety | Denied/revoked tests, no content leakage, duplicate-install tests, performance trace |
| Browser integration | Real staging CSP/CORS/SRI tests; desktop/mobile coverage and limitations |
| Intake durability | Commit-before-ACK, duplicate and outage tests, quotas, bounded inputs |
| Analytical correctness | Test vectors, cohort rules, denominators, layout exclusions, late-data behavior |
| Reference safety | Approved capture/import artifacts, masks, sandbox/egress evidence or manual-only mode |
| Private access | Login, sessions, CSRF, site permissions, export/image authorization |
| Multi-domain isolation | Complete disabled inventory, configuration-only expansion, no cross-site event/reference leaks, scoped portfolio totals/cache/export tests |
| Deployment | Stable approved HTTPS endpoint, private data plane, secret handling, process supervision |
| Recovery | Successful backup restore and deletion replay with measured RPO/RTO or explicit revised targets |
| Capacity | Load report with hardware, sustained rate, latency, failure rate, disk growth, worker lag |
| Supply chain | Lockfile, SBOM, scans, artifact hashes, dependency review |
| Operations | Owner, alerts, support runbooks, kill switch, rollback artifact |
| Data lifecycle | Tested retention and deletion across raw/facts/aggregates/references/exports/backups |

**Automatic release blockers:** active placeholder secrets/URLs, collection before consent, sensitive field capture, wildcard real-site enablement, public dashboard/database through the collector, unauthenticated management, unknown data ownership, durable ACK without persistence, unreviewed remote screenshot browsing, or missing restore evidence for live deployment.

---

## 32. Future extensions and explicit non-goals

Keep future work out of the release-one critical path. Multi-domain registries, additional-property onboarding through configuration, and the requested three domain families are already release-one requirements, not future extensions. Candidate extensions are authenticated corporate SSO, more precise element-state references, accessibility-focused action reporting, statistical experiment analysis, and a measured higher-volume storage backend.

Session replay, cross-domain identity stitching, arbitrary custom events, persistent visitor IDs, player-account linkage, financial conversions, behavioral targeting, detailed device fingerprinting, and unrestricted remote capture are not "small toggles." Each would require a new privacy/security/data-model review and separate implementation specification.

The custom renderer may later use WebGL, but Canvas 2D with bounded tiles is the initial implementation. An AI explanation feature is not required and must not send customer behavior to an external service without an explicit approved design.

---

## 33. Environment variable contract

Create `.env.example` with descriptions and safe non-secret placeholders. Bootstrap generates local secrets without printing them; production uses its approved secret mechanism. Backend-only secrets must never have a frontend-public prefix such as `VITE_`.

```dotenv
# General
APP_ENV=development
DATA_MODE=synthetic
LOG_LEVEL=info
DISPLAY_TIMEZONE=Europe/Bucharest
REPORTING_TIMEZONE=UTC

# Local loopback entry points
DASHBOARD_BIND=127.0.0.1
DASHBOARD_PORT=3000
DASHBOARD_ORIGIN=http://127.0.0.1:3000
COLLECTOR_BIND=127.0.0.1
COLLECTOR_PORT=8080
PUBLIC_COLLECTOR_ORIGIN=http://127.0.0.1:8080
DEMO_ORIGIN=http://127.0.0.1:4173

# Generate separate secrets/URLs during bootstrap; inject only to correct service.
DB_MIGRATOR_URL=GENERATE_LOCAL_ONLY
DB_COLLECTOR_URL=GENERATE_LOCAL_ONLY
DB_WORKER_URL=GENERATE_LOCAL_ONLY
DB_MANAGEMENT_URL=GENERATE_LOCAL_ONLY
SESSION_SECRET=GENERATE_AT_LEAST_32_RANDOM_BYTES
RATE_BUCKET_SECRET=GENERATE_AT_LEAST_32_RANDOM_BYTES

# Collection defaults
REAL_SITES_ENABLED=false
REQUIRE_ANALYTICS_CONSENT=true
REQUIRE_PUBLIC_CONTEXT=true
TRACKER_FLUSH_MS=5000
TRACKER_BATCH_MAX_EVENTS=50
TRACKER_BATCH_MAX_BYTES=24576
TRACKER_QUEUE_MAX_EVENTS=200
TRACKER_QUEUE_MAX_BYTES=131072
TRACKER_QUEUE_TTL_MS=60000
COLLECTOR_BODY_LIMIT_BYTES=32768
COLLECTOR_MAX_EVENT_DELAY_HOURS=24
CONFIG_FRESHNESS_SECONDS=60
MAX_VIEW_AGE_HOURS=24
VIEW_IDLE_MINUTES=30

# Processing and reports
WORKER_CONCURRENCY=2
WORKER_LEASE_SECONDS=60
WORKER_MAX_ATTEMPTS=8
MIN_REPORT_VIEWS=20
AGGREGATION_VERSION=1

# Storage/retention; owner review required for live data.
STORAGE_DRIVER=filesystem
STORAGE_ROOT=/data/references
RAW_RETENTION_DAYS=30
FACT_RETENTION_DAYS=32
RECEIPT_RETENTION_DAYS=7
AGGREGATE_RETENTION_DAYS=180
REFERENCE_RETENTION_DAYS=180
EXPORT_RETENTION_HOURS=24
LOG_RETENTION_DAYS=14
BACKUP_RETENTION_DAYS=14

# Capture; manually imported references work without remote capture.
REMOTE_CAPTURE_ENABLED=false
CAPTURE_CONCURRENCY=1
CAPTURE_TIMEOUT_SECONDS=45
CAPTURE_MAX_PIXELS=40000000
CAPTURE_MAX_UPLOAD_BYTES=20971520

# Networking/security
TRUSTED_PROXY_CIDRS=
COOKIE_SECURE=false
ALLOW_LOOPBACK_HTTP=true
DEBUG_TRACKER=false
```

The example placeholders are not valid startup secrets. Implement profile-specific validation, secret-file equivalents, and an explicit error for invalid settings. Production requires `APP_ENV=production`, real data mode only after approval, HTTPS, secure cookies for a hosted management origin, no debug, and no loopback HTTP exception for real sites. A separate local UI proxy profile may keep its own loopback-only development cookie; do not weaken the remote management service to accommodate it.

Do not use the global `REAL_SITES_ENABLED` flag as the only approval. Each property and route still needs its own record. Changing sampling/retention is audited and versioned; environment variables provide defaults, not a bypass around the registry.

---

## 34. Configuration examples

### 34.1 Disabled origin supporting the selected landing page

```json
{
  "slug": "netbet-ro-go",
  "display_name": "go.netbet.ro landing pages",
  "domain_group_key": "netbet-ro",
  "site_family": "go",
  "host_label": "go",
  "origin_verification": "UNKNOWN",
  "environment": "production",
  "enabled": false,
  "approval_state": "pending",
  "origins": ["https://go.netbet.ro"],
  "collection_mode": "selected_pages",
  "page_rules": [],
  "sample_rate": 0.1,
  "campaign_codes": ["unknown"],
  "require_consent": true,
  "require_public_context": true,
  "note": "Only a supporting origin record. The Halloween page is a separate disabled draft. No permission for the root, entire path, product hosts, or parent hosts."
}
```

The property and its target each require approval and enablement. The sample rate does nothing while disabled. The default inventory is `config/netbet-landing-pages.disabled.json`; it contains one supporting property and one disabled selected-page draft. The earlier 15-host catalog is optional, not a prerequisite.

### 34.2 Enabled synthetic fixture config

```json
{
  "schema_version": 2,
  "site_key": "site_local_demo",
  "config_version": 1,
  "enabled": true,
  "collection_mode": "selected_pages",
  "environment": "development",
  "allowed_origins": ["http://127.0.0.1:4173"],
  "sample_rate": 1,
  "valid_for_seconds": 60,
  "pages": [
    {
      "page_key": "demo-casino-landing",
      "path": "/demo/landing",
      "selector": {
        "query_equals": {"lp": "demo-a"},
        "ignored_query_names": ["utm_source"],
        "other_query_policy": "reject",
        "duplicate_query_policy": "reject",
        "fragment_policy": "ignore_anchor"
      },
      "revision": "demo-r1",
      "locale": "ro-RO",
      "variant": "control",
      "state": "public-default",
      "element_ids": ["hero", "hero-register", "benefits", "footer"],
      "actions": {"hero-register": "registration-start"},
      "campaign_codes": ["unknown", "demo-test"]
    }
  ]
}
```

Public config and generated local-manifest schemas are version 2; event and reference-manifest schemas remain version 1. Public config normalizes each `allowed_origins[0]` + page `path` + selector policy into the same `LandingPageSelectorV2` structure used by the installed manifest; do not make path-only copies or a separate matcher. This fixture requires `/demo/landing?lp=demo-a`, not just the path.

The real public config endpoint emits the schema's approved subset. Admin-only notes, sensitive route details where unnecessary, users, provider credentials, and approval documents are never returned to the tracker.

### 34.3 Reference import example

```json
{
  "schema_version": 1,
  "site_id": "11111111-1111-4111-8111-111111111111",
  "page_key": "demo-casino-landing",
  "revision": "demo-r1",
  "locale": "ro-RO",
  "variant": "control",
  "state": "public-default",
  "captured_at": "2026-10-16T12:00:00.000Z",
  "viewport": {"width": 1440, "height": 900, "dpr": 1},
  "document": {"width": 1440, "height": 3000},
  "image": {
    "object_key": "SERVER_ASSIGNED_AFTER_UPLOAD",
    "sha256": "SERVER_COMPUTED_AFTER_REENCODING",
    "pixel_width": 1440,
    "pixel_height": 3000,
    "css_to_image_scale": 1
  },
  "layer": "document",
  "elements": [
    {
      "id": "hero-register",
      "rect": {"x": 620, "y": 480, "width": 200, "height": 56},
      "layer": "document"
    }
  ],
  "masks": [],
  "capture_policy_version": "capture-v1",
  "capture_status": "pending-review"
}
```

This illustrates metadata, not an actual screenshot from NetBet. Server-owned object key/hash fields are calculated at import and cannot be selected by a client. The manifest is approved only after its ownership, image geometry, and review status are verified.

### 34.4 Optional disabled host-catalog contract

The optional `config/netbet-sites.disabled.json` catalog is configuration data, not executable installation code, a default import, or a required rollout checklist. Its schema contains `registry_schema_version`, `spec_version`, `brands`, `site_families`, `domain_groups`, and `properties`. Domain groups carry an explicit `domain_root`, a brand key, and an optional owner-assigned `market_code`. Catalog schema version 2 requires each property's slug, domain-group key, family code, host label, exact one-entry `origins` array, environment, candidate verification state, pending approval, `enabled=false`, `collection_mode=selected_pages`, and empty `page_rules`. The existing top-level fields are retained; catalog-only intent is documented in `purpose` rather than granting any permissions.

Codex must implement bounded JSON Schema validation and an idempotent disabled-only import. No unknown fields, public/private keys, permission grants, enabled sites, executable adapters, or imported page approvals are accepted. Generate IDs/public keys server-side only for new records. The supplied file has three groups, four family definitions, and fifteen properties. Use an explicit catalog import only when wanted; normal landing-page onboarding creates the required origin on demand. The standalone specification does not require the ZIP to understand its scope.

Implement and test these additional CLI interfaces; they do not exist yet in this documentation delivery:

```bash
pnpm registry:validate -- config/netbet-sites.disabled.json
pnpm registry:import -- config/netbet-sites.disabled.json --dry-run
pnpm registry:import -- config/netbet-sites.disabled.json --disabled-only
pnpm test:multisite
```

The importer requires an authenticated/authorized management context or an explicitly privileged local admin CLI, never the public collector. It cannot enable or reconfigure an existing property on repeat runs. Produce a bounded conflict report before making changes. Do not use a production candidate import as the fixture data source for browser tests; use separate synthetic origins and identities.

### 34.5 Default selected-page draft import contract

Implement `config/netbet-landing-pages.disabled.json` with these top-level fields: `selection_schema_version=1`, `spec_version`, `purpose`, `default_collection_mode=selected_pages`, `brands`, `site_families`, `domain_groups`, `properties`, and `landing_pages`. The origin metadata uses the schema-v2 property shape. This separate import format is for disabled drafts only, not public collector configuration.

Each landing page has a site slug, immutable proposed page key, display/product labels, `collection_mode=selected_pages`, `enabled=false`, `approval_state=pending`, an exact selector as defined in section 7.9, and UNKNOWN release/integration status. Validate origin consistency, URL/path/query limits, selector overlap, pending state, and all allowed fields. There are no secrets, public keys, cookies, inferred releases, remote fetches, or granted approvals in the file. Create page keys/metadata transactionally after a dry-run conflict plan; generate internal IDs/site keys on the server. Reimport is idempotent and must not reset or reconfigure an existing record.

Only `netbet-ro-go` and `casino-halloween` are present in the supplied default example. Additional campaigns or markets are added explicitly through the same UI/API. The optional legacy catalog must not be imported by this command as a side effect. Implement:

```bash
pnpm landing-pages:validate -- config/netbet-landing-pages.disabled.json
pnpm landing-pages:import -- config/netbet-landing-pages.disabled.json --dry-run
pnpm landing-pages:import -- config/netbet-landing-pages.disabled.json --disabled-only
pnpm test:landing-pages
```

These are required future application commands, not executables delivered by the documentation. `config/landing-page-match.examples.json` contains pure string-matching fixtures. No fixture URL is permission to contact or instrument a real site. Its candidate rules test selection logic only; all real collection remains disabled in the actual draft inventory.

---

## 35. Reference database DDL

### 35.1 Core migration blueprint

The SQL below is a core schema starting point, not a complete migration set. It deliberately does not provide default users, passwords, live origins, or an enabled production site. Codex must add the remaining registries, auth, rollup, reference, audit, deletion, backup metadata, permissions, and tests described elsewhere.

Use application-generated UUIDs so a UUID extension is not a prerequisite. Do not run this automatically against an existing production database. PostgreSQL 18 is the reference target. The grouping additions below describe a fresh schema; existing databases need the staged migration in section 7.8. Synthetic sites use separately seeded demo grouping/family records. Validate safe registry codes and canonical origins in application schemas; add the approval/audit/immutability rules and indexes required by the specification. A group archive blocks new member creation, not an undocumented bulk-enable/disable operation.

```sql
CREATE TABLE brands (
  id uuid PRIMARY KEY,
  registry_key text NOT NULL UNIQUE,
  display_name text NOT NULL
);

CREATE TABLE domain_groups (
  id uuid PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES brands(id),
  registry_key text NOT NULL UNIQUE,
  domain_root text NOT NULL,
  display_name text NOT NULL,
  market_code text,
  archived boolean NOT NULL DEFAULT false,
  UNIQUE (brand_id, domain_root)
);

CREATE TABLE site_families (
  code text PRIMARY KEY,
  display_name text NOT NULL
);

CREATE TABLE sites (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  public_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  domain_group_id uuid NOT NULL REFERENCES domain_groups(id),
  site_family text NOT NULL REFERENCES site_families(code),
  host_label text NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  environment text NOT NULL
    CHECK (environment IN ('development', 'staging', 'production')),
  enabled boolean NOT NULL DEFAULT false,
  collection_mode text NOT NULL DEFAULT 'selected_pages'
    CHECK (collection_mode = 'selected_pages'),
  approval_state text NOT NULL DEFAULT 'pending'
    CHECK (approval_state IN (
      'pending', 'demo-approved', 'pilot-approved', 'production-approved'
    )),
  config_version integer NOT NULL DEFAULT 1 CHECK (config_version > 0),
  sample_rate double precision NOT NULL DEFAULT 0.1
    CHECK (sample_rate > 0 AND sample_rate <= 1),
  max_daily_events bigint NOT NULL DEFAULT 1000000
    CHECK (max_daily_events > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT enabled OR approval_state <> 'pending'),
  CHECK (environment <> 'production' OR approval_state <> 'demo-approved')
);

CREATE TABLE site_origins (
  site_id uuid NOT NULL REFERENCES sites(id),
  origin text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  verification_state text NOT NULL DEFAULT 'UNKNOWN',
  PRIMARY KEY (site_id, origin),
  UNIQUE (site_id),
  UNIQUE (origin)
);

CREATE TABLE pages (
  site_id uuid NOT NULL REFERENCES sites(id),
  page_key text NOT NULL,
  canonical_path text NOT NULL,
  page_kind text NOT NULL DEFAULT 'landing_page',
  product_code text,
  collection_enabled boolean NOT NULL DEFAULT false,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, page_key)
);

-- This table extends the migration blueprint; it is not an executed migration.
-- Validate bounded flat JSON, names, values, and overlap in management code.
CREATE TABLE page_selectors (
  site_id uuid NOT NULL,
  page_key text NOT NULL,
  selector_version integer NOT NULL CHECK (selector_version > 0),
  query_equals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ignored_query_names text[] NOT NULL DEFAULT '{}',
  other_query_policy text NOT NULL DEFAULT 'reject'
    CHECK (other_query_policy = 'reject'),
  duplicate_query_policy text NOT NULL DEFAULT 'reject'
    CHECK (duplicate_query_policy = 'reject'),
  fragment_policy text NOT NULL DEFAULT 'ignore_anchor'
    CHECK (fragment_policy IN ('ignore_anchor', 'reject')),
  selector_fingerprint bytea NOT NULL
    CHECK (octet_length(selector_fingerprint) = 32),
  PRIMARY KEY (site_id, page_key),
  FOREIGN KEY (site_id, page_key) REFERENCES pages(site_id, page_key),
  UNIQUE (site_id, selector_fingerprint),
  CHECK (jsonb_typeof(query_equals) = 'object')
);

CREATE TABLE page_groups (
  id uuid PRIMARY KEY,
  group_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  archived boolean NOT NULL DEFAULT false
);

CREATE TABLE page_group_members (
  page_group_id uuid NOT NULL REFERENCES page_groups(id),
  site_id uuid NOT NULL,
  page_key text NOT NULL,
  PRIMARY KEY (page_group_id, site_id, page_key),
  FOREIGN KEY (site_id, page_key) REFERENCES pages(site_id, page_key)
);

CREATE TABLE page_releases (
  site_id uuid NOT NULL,
  page_key text NOT NULL,
  revision text NOT NULL,
  locale text NOT NULL,
  variant text NOT NULL,
  state text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, page_key, revision, locale, variant, state),
  FOREIGN KEY (site_id, page_key) REFERENCES pages(site_id, page_key)
);

CREATE TABLE view_registry (
  site_id uuid NOT NULL,
  view_id uuid NOT NULL,
  page_key text NOT NULL,
  revision text NOT NULL,
  locale text NOT NULL,
  variant text NOT NULL,
  state text NOT NULL,
  campaign text NOT NULL,
  origin text NOT NULL,
  started_at timestamptz NOT NULL,
  view_day date NOT NULL,
  first_received_at timestamptz NOT NULL DEFAULT now(),
  config_version integer NOT NULL,
  sample_rate double precision NOT NULL CHECK (sample_rate > 0 AND sample_rate <= 1),
  consent_policy_version text NOT NULL,
  context_hash bytea NOT NULL CHECK (octet_length(context_hash) = 32),
  PRIMARY KEY (site_id, view_id),
  FOREIGN KEY (site_id, page_key, revision, locale, variant, state)
    REFERENCES page_releases(site_id, page_key, revision, locale, variant, state),
  FOREIGN KEY (site_id, origin) REFERENCES site_origins(site_id, origin),
  CHECK (view_day = (started_at AT TIME ZONE 'UTC')::date)
);
CREATE INDEX view_registry_site_day_idx ON view_registry(site_id, view_day);

CREATE TABLE event_receipts (
  site_id uuid NOT NULL REFERENCES sites(id),
  event_id uuid NOT NULL,
  payload_hash bytea NOT NULL CHECK (octet_length(payload_hash) = 32),
  first_received_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (site_id, event_id),
  CHECK (expires_at > first_received_at)
);
CREATE INDEX event_receipts_expiry_idx ON event_receipts(expires_at);

CREATE TABLE events_raw (
  site_id uuid NOT NULL,
  received_at timestamptz NOT NULL,
  event_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  view_id uuid NOT NULL,
  segment_id uuid NOT NULL,
  seq integer NOT NULL CHECK (seq >= 0),
  event_type text NOT NULL CHECK (event_type IN (
    'page_view', 'segment_start', 'click', 'activation', 'progress', 'exposure'
  )),
  elapsed_ms bigint NOT NULL CHECK (elapsed_ms >= 0 AND elapsed_ms <= 86400000),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  payload_hash bytea NOT NULL CHECK (octet_length(payload_hash) = 32),
  PRIMARY KEY (site_id, received_at, event_id),
  FOREIGN KEY (site_id, view_id) REFERENCES view_registry(site_id, view_id)
) PARTITION BY RANGE (received_at);

-- Example only. Partition management creates real current/future UTC ranges.
CREATE TABLE events_raw_2026_10_16 PARTITION OF events_raw
  FOR VALUES FROM ('2026-10-16 00:00:00+00')
           TO ('2026-10-17 00:00:00+00');

CREATE INDEX events_raw_site_view_idx ON events_raw(site_id, view_id, seq);
CREATE INDEX events_raw_site_type_time_idx
  ON events_raw(site_id, event_type, received_at);
-- Deliberately no FK from events_raw to expiring event_receipts.
-- Raw retention is longer than receipt retention.

CREATE TABLE site_day_quotas (
  site_id uuid NOT NULL REFERENCES sites(id),
  received_day date NOT NULL,
  accepted_events bigint NOT NULL DEFAULT 0 CHECK (accepted_events >= 0),
  PRIMARY KEY (site_id, received_day)
);

CREATE TABLE ingest_jobs (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id),
  aggregation_version integer NOT NULL CHECK (aggregation_version > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'failed')),
  raw_refs jsonb NOT NULL CHECK (jsonb_typeof(raw_refs) = 'array'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  lease_token uuid,
  worker_id text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ingest_jobs_ready_idx ON ingest_jobs(available_at, created_at)
  WHERE status = 'pending';
CREATE INDEX ingest_jobs_expired_idx ON ingest_jobs(locked_until)
  WHERE status = 'running';

CREATE TABLE processed_jobs (
  job_id uuid NOT NULL REFERENCES ingest_jobs(id),
  aggregation_version integer NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, aggregation_version)
);

CREATE TABLE view_facts (
  site_id uuid NOT NULL,
  view_id uuid NOT NULL,
  has_page_view boolean NOT NULL DEFAULT false,
  pointer_clicks bigint NOT NULL DEFAULT 0 CHECK (pointer_clicks >= 0),
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  aggregation_version integer NOT NULL,
  PRIMARY KEY (site_id, view_id, aggregation_version),
  FOREIGN KEY (site_id, view_id) REFERENCES view_registry(site_id, view_id)
);

CREATE TABLE segment_facts (
  site_id uuid NOT NULL,
  view_id uuid NOT NULL,
  segment_id uuid NOT NULL,
  aggregation_version integer NOT NULL,
  has_segment_start boolean NOT NULL DEFAULT false,
  viewport_width integer NOT NULL CHECK (viewport_width > 0),
  viewport_height integer NOT NULL CHECK (viewport_height > 0),
  document_width integer NOT NULL CHECK (document_width > 0),
  document_height integer NOT NULL CHECK (document_height > 0),
  geometry_state text NOT NULL,
  max_reach_px double precision NOT NULL DEFAULT 0,
  max_reach_percent double precision NOT NULL DEFAULT 0
    CHECK (max_reach_percent BETWEEN 0 AND 100),
  max_scroll_percent double precision NOT NULL DEFAULT 0
    CHECK (max_scroll_percent BETWEEN 0 AND 100),
  visible_ms bigint NOT NULL DEFAULT 0 CHECK (visible_ms >= 0),
  PRIMARY KEY (site_id, view_id, segment_id, aggregation_version),
  FOREIGN KEY (site_id, view_id, aggregation_version)
    REFERENCES view_facts(site_id, view_id, aggregation_version)
);
```

### 35.2 Required schema extensions

For selected pages, `pages.canonical_path` is deliberately not unique: different `lp` choices can share a path. Compute `selector_fingerprint` server-side using a maintained SHA-256 implementation over canonical serialization of the exact path plus sorted public rendering-selector pairs, scoped by site. Ignored-query policy is versioned policy, not a different page identity. Validate JSON key/value bounds and all selector conflicts under a site-level transaction lock before publishing; the fingerprint constraint alone does not detect every overlap. Exact origin comes from `site_origins`, not a duplicated editable field. Make target identity immutable after first collection; a different target gets a different page key.

Store selector history in the existing immutable configuration snapshots with a versioned public schema. Add `sites.collection_mode` with `selected_pages` as the release-one default, and enforce both site and page enablement at durable ingestion. Historical context references must not be rewritten when policies change. Include selected-page IDs in all cache/query/export/reference indexes and authorization joins. Apply additive migrations to existing databases; do not run fresh CREATE TABLE examples over populated tables.

`element_registry` must map release-specific safe IDs to roles and approved action names. `view_element_facts` must separately store `had_pointer_click`, `had_activation`, `qualified_exposure`, and cumulative exposure, with a unique site/view/element/context/version key. Pointer clicks on mapped CTA elements can derive activation membership without a second automatic event. Add `segment_element_facts` to merge cumulative exposure maxima within each segment before summing disjoint segment durations; derive view-level exposure membership without duplicate counts. Add `view_action_facts` unique on site/view/action/version so a hero and footer button for the same action do not count the view twice. Use deterministic row-lock ordering when concurrent jobs update these memberships and their aggregate transitions.

A `cohorts` registry stores a canonical bounded dimension object and a deterministic key. Verify canonical equality on key collision rather than treating a hash as infallible. `heatmap_cells` stores cohort/layer/element/cell coordinates plus count; `daily_metrics` stores correct numerators/denominators. Keep unknown values as explicit registry codes rather than nullable primary-key components.

Add database constraints for finite coordinates, maximum code lengths, validated config versions, and actual safe enums. The JSON Schema is the primary external validation, but critical storage invariants belong in the database too.

### 35.3 Worker leasing sketch

```sql
-- Execute in a short transaction. The caller supplies a fresh lease token.
WITH candidate AS (
  SELECT id
  FROM ingest_jobs
  WHERE status = 'pending' AND available_at <= now()
  ORDER BY created_at, id
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE ingest_jobs AS j
SET status = 'running',
    attempts = attempts + 1,
    worker_id = $1,
    lease_token = $2,
    locked_until = now() + interval '60 seconds'
FROM candidate AS c
WHERE j.id = c.id
RETURNING j.*;
```

A recovery loop returns expired running jobs to pending under locking and records the safe failure reason. A processing transaction locks the job, verifies its current lease token, inserts the processed ledger row, applies all idempotent facts/aggregate changes, and marks the job done atomically. If the ledger already exists for the version, mark the job complete without reapplying contributions.

Do not prune processed-job ledger records while the corresponding job might still be retried. Retention must delete completed job/ledger records in a referentially valid order and only after the retry/rebuild policy allows it.

---

## 36. API examples and error contract

### 36.1 Synthetic event batch

This is a structurally illustrative fixture. Its site/page/release must be registered in the test database, and timestamps must be regenerated for live test execution.

```json
{
  "schema_version": 1,
  "sdk_version": "1.0.0",
  "site_key": "site_local_demo",
  "batch_id": "22222222-2222-4222-8222-222222222222",
  "config_version": 1,
  "view_id": "33333333-3333-4333-8333-333333333333",
  "view_started_at": "2026-10-16T12:00:00.000Z",
  "sample_rate": 1,
  "consent": {"analytics": true, "policy_version": "demo-consent-v1"},
  "context": {
    "page_key": "demo-casino-landing",
    "revision": "demo-r1",
    "locale": "ro-RO",
    "variant": "control",
    "state": "public-default",
    "campaign": "demo-test"
  },
  "events": [
    {
      "event_id": "44444444-4444-4444-8444-444444444444",
      "seq": 0,
      "type": "page_view",
      "elapsed_ms": 0,
      "segment_id": "55555555-5555-4555-8555-555555555555",
      "viewport": {
        "width": 1440, "height": 900, "dpr": 1,
        "visual_scale": 1, "visual_offset_x": 0, "visual_offset_y": 0,
        "scroll_x": 0, "scroll_y": 0,
        "document_width": 1440, "document_height": 3000
      }
    }
  ]
}
```

A `page_view` establishes the initial segment as well as the view; a separate `segment_start` is needed only for subsequent geometry segments. Encode this rule in the contracts and workers so the initial denominator is not missing or doubled.

### 36.2 Status contract

| HTTP | Meaning | SDK action |
| --- | --- | --- |
| `204` | All valid events durably accepted or identical duplicates | Remove acknowledged events |
| `400` | Invalid JSON/schema/context | Drop batch; safe diagnostic counter |
| `403` | Origin/site/page not authorized or disabled | Stop relevant view; do not retry |
| `409` | Conflicting duplicate ID or immutable view context | Drop; surface integrity diagnostic |
| `413` | Request above configured bound | Drop or re-split only unsent-valid events under a tested policy |
| `415` | Unsupported content type/encoding | Drop; integration error |
| `429` | Quota/rate limit | Bounded retry using `Retry-After` where allowed |
| `503` | Durable backend temporarily unavailable | Bounded retry; no claim of acceptance |

Return errors such as `{"error":"INVALID_EVENT","request_id":"..."}` without field values, SQL, stack traces, or private configuration. CORS headers must be consistent on applicable errors so an approved browser can distinguish failure types. Unapproved origins do not receive permissive headers.

### 36.3 Heatmap response shape

```ts
interface HeatmapResponse {
  query_id: string;
  aggregation_version: number;
  cohort: ApprovedCohort;
  reference_id: string | null;
  reference_status: 'compatible' | 'missing' | 'incompatible';
  observation_unit: 'views' | 'segments';
  observed_denominator: number;
  mapped_clicks: number;
  excluded_clicks: number;
  orphan_views: number;
  sample_rates: number[];
  reporting_timezone: 'UTC';
  provisional: boolean;
  suppressed: boolean;
  processed_through: string;
  cells: Array<{ x: number; y: number; count: number }>;
  legend: { units: string; max_value: number; shared_scale: boolean };
}
```

A suppressed response contains no small-cohort cells. Counts must not reveal suppressed cells through a trivial total-minus-visible difference without a reviewed disclosure policy. A missing reference can still allow aggregate counts but not a falsely labeled valid screenshot overlay.

---

## 37. Acceptance scenarios and metric test vectors

### 37.1 Coordinate vectors

**Scrolled document click:** `client=(100,200)`, `scroll=(0,500)` gives document `(100,700)`. DPR 2 does not make the stored point `(200,1400)`. Canvas backing storage handles DPR later.

**Element-relative click:** target box `(left=200, top=300, width=100, height=50)` and click `(225,310)` give `(u=0.25,v=0.20)`. A compatible reference box `(left=400,top=600,width=200,height=100)` gives `(450,620)`.

**Fixed header:** a click at viewport Y 40 while the page is scrolled 2000 pixels belongs to the fixed viewport layer at 40, not to a normal page hotspot at 2040.

**Keyboard CTA:** a trusted non-pointer activation contributes to the registered action's view membership and produces no `(0,0)` heatmap dot.

### 37.2 Scroll vector

With `H=2000`, `V=800`, `Y=0`, reach is 40% while scroll progress is 0%. With `Y=600`, reach is 70% and scroll progress is 50%. With `Y=1200`, both are 100%. With `H=600`, `V=800`, `Y=0`, reach is 100% and scroll progress is 0%.

For 100 confirmed views, with 60 observed reaching depth 50% and 25 reaching depth 90%, report 60% and 25% reach for those thresholds, assuming compatible stable segments and known measurement coverage. Do not use only the scrolling subset as denominator.

### 37.3 Action/exposure vector

Start with 100 confirmed views. Forty meet CTA exposure. Twenty activate the CTA. Fifteen are in both sets. The page activation rate is 20/100 = 20%; exposed-view activation rate is 15/40 = 37.5%, not 20/40 = 50%. If one of the twenty activated views clicks ten times, the activated-view count remains twenty, while pointer-click count increases appropriately.

Day A has 1 activated view out of 10; Day B has 90 out of 100. The combined rate is 91/110, approximately 82.73%, not the average of 10% and 90%.

### 37.4 Duplicate/crash vector

One accepted batch contains event IDs A, B, C. A network retry sends A, B, C again, then another sends B, C, D. Raw unique events and rollup event contributions total four. Killing the worker after its commit but before the process acknowledges its job must not change four into eight.

The same UUID paired with different canonical content yields a conflict. Replaying a batch at midnight must not create a second event merely because it enters a different receipt-time partition.

### 37.5 Consent and context race vector

At time 0 consent is granted and the script starts downloading. At time 1 consent is revoked. At time 2 the script finishes. No view, config fetch, or event collection starts after time 2. The loader may have completed a static download already in flight; it must not convert that into behavioral tracking.

Calling `setContext` repeatedly with identical immutable context is a no-op. Changing revision, locale, variant, state, or route creates a fresh view only when eligible and consented. A geometry resize creates a segment, not a duplicate whole-page view. An excluded context discards pending behavioral data rather than flushing it during revocation/ineligibility.

### 37.6 Activation deduplication policy

A pointer click on a registered CTA is the canonical pointer event; the processor derives its action membership from the element/action registry. Do not automatically emit a second `activation` event for the same pointer gesture. Non-pointer/keyboard or explicitly host-signaled actions use `activation`. `trackAction` is for approved semantic actions not already represented by a tracked pointer CTA.

If the host accidentally reports the same action twice, view-level action metrics still deduplicate by view/action. Avoid presenting total action-event count as a business conversion metric. The local debugger should flag redundant manual bindings.

### 37.7 Time and retention vector

A view starts at 23:59 UTC and receives a click at 00:01 UTC. Its whole-view denominator/action membership remains on the original UTC start date. Both raw events are stored by their own server receipt timestamps. A 30-day raw retention task must not remove an unprocessed event still required by an accepted job without raising a policy/operational failure.

When raw data/facts expire, a query requiring per-view intersection across an unsupported historical interval returns an explicit unsupported/suppressed result rather than inventing it from unrelated aggregates.

### 37.8 Multi-domain acceptance matrix

Implement these as executable tests using synthetic origins and database fixtures. A fixture may use an isolated local listener on several loopback ports or test-only hostname routing; never proxy synthetic analytics to real NetBet sites. Check production-candidate host parsing as pure input data without requiring live DNS.

| ID | Test | Required result |
| --- | --- | --- |
| MD-01 | Explicitly import the OPTIONAL host catalog into a fresh fixture database | Three domain groups, four families, 15 disabled candidate properties, 15 unapproved origins, zero active real-page rules; no network calls. A normal selected-page setup need not run this import |
| MD-02 | Import the same inventory twice | Stable UUIDs/site keys; no duplicates, permission changes, enablement, or overwrite of existing site policy |
| MD-03 | Add a fourth synthetic domain group and a new family/property using API/CLI | Works without changing or rebuilding SDK/backend/dashboard source |
| MD-04 | Use site A's public key from site B's exact origin | Reject before persistence; no fallback to sibling/parent site |
| MD-05 | Query the same page key/revision/element ID on two sites | Independent metrics, references, heatmap cells, deletion scope, and exports |
| MD-06 | Analyst is assigned one site but requests group/all-site metrics | Only authorized rows/totals; no restricted site existence/count leak through caches, pagination, errors, or downloads |
| MD-07 | Approved parent property plus unknown/unapproved child hostname | Child collection remains rejected; parent approval grants nothing |
| MD-08 | Parse co.uk candidates and deceptive hostnames | Keep netbet.co.uk as explicit group; reject casino.netbet.co.uk.attacker.invalid, netbet.com.attacker.invalid, nonapproved ports and null origins |
| MD-09 | HTTP redirect fixture on go origin to independently eligible target | Zero tracker view at redirect-only source; one target view only after that target's own consent/policy gates |
| MD-10 | Disable site A under traffic | Site A stops acceptance under the kill policy; site B stays unchanged; global stop remains separately testable |
| MD-11 | Portfolio counts: site A 100 confirmed views, site B 200 confirmed views | 300 tracked page views, never 300 unique visitors; no identity linkage |
| MD-12 | Same approved metric: A has 10/100 activated views and B has 10/200 | Combined compatible rate is 20/300, approximately 6.67%, not the 7.5% average; different definitions/sampling suppress combined rate |
| MD-13 | Request one pixel heatmap across two origins or use site A's reference for B | Fail validation/authorization; side-by-side comparison remains available with separate maps |
| MD-14 | Shared installation selector receives an unlisted exact origin | No fallback config, no events; one known origin resolves only its reviewed site key/adapter |
| MD-15 | Add new domain group/site while an analyst has an old sibling grant | No inherited permission; an owner must grant the new site explicitly |
| MD-16 | One property exceeds its quota or has a large processing backlog | Per-site limits/fairness prevent it from silently consuming all other properties' budgets |
| MD-17 | Attempt production-ready install export for a pending candidate | Produce missing-requirements report, not a deployable production snippet |
| MD-18 | Upgrade existing three-property database with known synthetic history | Preserve IDs/keys/history/grants; add only explicitly selected missing origins disabled; conflicting origins abort safely; no forced parent-host import |

Use the reporting fixture's minimum-sample policy explicitly. Tests claiming privacy/suppression correctness must not globally disable suppression just to make counts convenient. A passing multi-domain unit test does not establish a live site's consent/CSP integration or deployment permission.

### 37.9 Selected landing-page acceptance matrix

Implement these tests against synthetic page/CMP/router fixtures. The owner URL is input data for pure matching tests only, not a test-traffic destination. Matching fixtures assume approved synthetic policies when needed; real seed records remain disabled.

| ID | Test | Required result |
| --- | --- | --- |
| LP-01 | Only the default selected-page import on a fresh database | One disabled go.netbet.ro property and casino-halloween draft; no parent/product-site dependency; no collection |
| LP-02 | Exact Halloween URL after all fixture gates pass | Resolve casino-halloween and begin one eligible view |
| LP-03 | Same origin/path with lp=christmas but no Christmas registration | No SDK/config/events calls; no fallback to Halloween |
| LP-04 | Same origin/path without lp, or with an empty lp | No match and no collection |
| LP-05 | Root URL, parent website, or casino/sport product homepage | No match, download, config request, event, or identity carryover |
| LP-06 | Approved lp plus reviewed ignored utm_source; reorder query parameters | Same page key; raw attribution value is never emitted or retained |
| LP-07 | Repeated lp, including identical values or encoded duplicate key names | Reject ambiguity; first/last-value behavior cannot select a target |
| LP-08 | Case changes, trailing-slash changes, double-encoded value, malformed escapes | Follow exact matching/one-decode contract; malformed or nonmatching forms stay inactive |
| LP-09 | Unknown extra query key or known unapproved rendering variant | No match; no automatic ignore or storage of raw value |
| LP-10 | Add a second reviewed lp target on the same origin/path | Separate page identity, references, metrics, exports, and kill state |
| LP-11 | Query-only navigation between selected targets | Pause before transition; wait for matching host readiness; new page/view; old DOM never attributed to the new campaign |
| LP-12 | Navigate from selected target to unselected target or remove lp | Remove observers, clear unsent data, stop polling, invalidate callbacks; no destination tracking |
| LP-13 | Only ignored attribution or anchor changes; target/context unchanged | Do not manufacture a new view or reinitialize the SDK |
| LP-14 | Consent unknown/denied/revoked on an otherwise matching target | Existing consent gates still prevent collection; no deferred replay |
| LP-15 | Disable one page while another same-origin target is approved | Reject disabled-page batches, including stale retries; sibling target remains unchanged |
| LP-16 | Host tries to claim Halloween pageKey at an unselected address | SDK/bridge reject locally; server tests do not misrepresent Origin as URL attestation |
| LP-17 | Capture Halloween reference | Construct URL with lp=halloween; validate page/release; never substitute the bare path or root |
| LP-18 | Capture/page redirects to an unselected parent destination | No automatic expansion; mismatch reported; no parent screenshot accepted for Halloween |
| LP-19 | Same selector label on .ro and an independently registered synthetic second origin | Different site/page partition, keys, approvals, references, and event identities |
| LP-20 | Mixed old path-only history during an upgrade | Preserve as legacy/unclassified; never relabel or merge into a selected campaign without evidence |
| LP-21 | Overlapping selector policies or a query key both ignored and rendering | Config publication fails transactionally; runtime ambiguity returns no match |
| LP-22 | UI Add landing page, save draft, reimport twice | One supporting origin; stable IDs/keys; disabled page; no mandatory 15-host import or permissions changes |
| LP-23 | Installer selects Halloween only, despite other site pages existing | Generated manifest includes only Halloween; shared-template/consent-positive neighboring URLs stay inactive |
| LP-24 | Public config enables a page absent from the installed manifest | No scope broadening; installed page allowlist remains an independent upper bound |
| LP-25 | Seasonal URL reused with a different reviewed content revision | Separate geometry cohort and approved reference; no silent overlay reuse |
| LP-26 | Oversized input, deceptive host, credentials, unsupported ports, raw backslashes | Reject safely without logging URL/query values, contacting the URL, or changing page behavior |
| LP-27 | Old path-only SDK requests selector-aware enabled config | Disabled/upgrade-required response; no compatibility fallback that widens capture |
| LP-28 | User clicks through to registration or an excluded overlay | Only approved public CTA activation may be recorded; form/account/overlay and destination interactions are excluded |
| LP-29 | Launch one landing page with no parent catalog records | Works fully; no missing-parent gate or automatic site creation; domain expansion remains optional |
| LP-30 | Browser network trace after unmatched route, plus a paused-init race | No new SDK/config/event requests; pending callbacks cannot revive collection; already sent requests are explicitly distinguished |

Run `pnpm test:landing-pages` plus existing privacy, contracts, browser, numerical, and multi-site suites. A JSON fixture check or documentation QA result is not evidence that the application, CMP integration, screenshot accuracy, or production release gates pass.

---

## 38. Codex kickoff prompt

Copy the main specification into `docs/NETBET_HEATMAP_BUILD_SPEC.md`, place the companion `AGENTS.md` at the repository root, and paste the following into the Codex workspace. Keep AGENTS short and point to the full document rather than placing this entire specification in automatically loaded instructions. Codex supports project instructions through AGENTS.md; automatic instruction loading has its own discovery/size behavior. [R22]

```text
Build the project defined in docs/NETBET_HEATMAP_BUILD_SPEC.md.

Read AGENTS.md and the complete build specification before editing code.
This is a real implementation task, not a request for another architecture outline.

Create our own local-first heatmap platform: TypeScript browser tracker,
Fastify collector and private API, PostgreSQL durable events/jobs, processing,
React dashboard, reference screenshots/manifests, and our own Canvas renderer.
Do not integrate an existing analytics platform, heatmap.js, or rrweb.
Do not require a runtime AI API, paid analytics subscription, or purchased domain.

Start with M0 and follow the milestone dependency order. Preserve existing work.
First deliver a reproducible Docker Compose local stack and synthetic fixtures.
Build selected landing-page tracking, not mandatory full-site tracking.
Use https://go.netbet.ro/casino/?lp=halloween as a disabled onboarding example:
exact origin + exact path + reviewed lp=halloween selector = one page.
Other lp values, bare /casino/, and parent/product homepages remain out of scope.
Start from config/netbet-landing-pages.disabled.json, not a forced 15-host import.
Keep multi-domain capability and isolated per-origin/page permissions and maps.
The previous host catalog is optional. No parent-site installation is required.
Implement section 7.9 and LP-01 through LP-30, including query-only navigation,
loader silence on unmatched pages, and screenshots of the exact selected page.
Implement real persistence, strict contracts, consent/public-context gating,
idempotent ingestion/processing, authentication, and numerical correctness.
Keep all real NetBet properties disabled. Do not deploy or modify live sites.

Use the specified safe defaults. Record unverified site-specific details as
UNKNOWN; implement fixture adapters instead of inventing NetBet CMP/router APIs.
Do not stop at a mock dashboard or report success for tests that were not run.

Maintain docs/IMPLEMENTATION_STATUS.md, docs/DECISIONS.md, and
 docs/PRODUCTION_READINESS.md with exact commands, evidence, failures, and gaps.
For each milestone implement code, run the relevant tests, fix defects, and
checkpoint progress. Do not weaken privacy/security requirements to make tests pass.

At the end of this session report what is implemented, how to run it locally,
what was tested, what remains, and the next concrete task. Production approval
requires human site/privacy/security authorization and release-gate evidence.
```

The companion `CODEX_START.md` adds task-sized follow-on prompts. When resuming, instruct Codex to read current implementation status and work on the next incomplete milestone rather than rebuilding from scratch.

---

## 39. Project-owner handoff checklist

The owner needs a company-approved development workstation, permission to create the internal project, a source-control location, and Docker or the host-native toolchain. Those are sufficient to begin the local synthetic build.

Before collecting real data, obtain exact landing-page URLs/final destinations, website deployment/tag access, CMP documentation, a reliable public-page eligibility signal, approved element/release IDs, CSP ownership, an approved always-on collection endpoint, a retention/access decision, and named security/privacy/operations owners.

Marketing's handoff is a site-specific installation package, not a database password. The engineer's handoff is a tested repository plus deployment/operations documentation, not a single copied script. A purchased domain is optional for local development and not a substitute for approved infrastructure or privacy review.

Deliverables expected from the completed implementation:

```text
[ ] Working local stack from a clean checkout
[ ] Synthetic responsive demo and fake CMP
[ ] Custom tracker with documented integration API
[ ] Public collector with durable, duplicate-safe ingestion
[ ] Database migrations and least-privilege runtime roles
[ ] Worker, facts, correct rates, and custom heatmap renderer
[ ] Private login-protected dashboard and authorized aggregate exports
[ ] Approved reference import/capture workflow
[ ] Selected-page URL/path/query setup, independent pause, and Marketing installer
[ ] LP-01 through LP-30 evidence, including no unwanted parent-site tracking
[ ] Passing privacy, numerical, integration, security, and recovery evidence
[ ] Backup/restore and retention/deletion runbooks
[ ] Dependency inventory, release hashes, and measured capacity report
[ ] Explicit list of production approvals and remaining limitations
```

---

## 40. Sources and verification notes

Version 1.2.0 follows the owner's more precise correction: individual landing pages such as `https://go.netbet.ro/casino/?lp=halloween`, without mandatory parent-site tracking. The 15-host inventory from version 1.1.0 is now an optional catalog, not a required rollout. Fetching the specific Halloween URL failed in this research environment on 2026-10-16; no page content, final destination, or live integration was verified for it. Scope and selector examples come from the owner-supplied URL. Do not transfer the root-only observation for go.netbet.com to this campaign URL.

R23-R25 were consulted for the query-aware revision on 2026-10-16. Earlier site observations and R01-R22 are retained historical references from version 1.0.0, not a fresh audit of all their content or candidate origins.

Primary/public sources consulted for version 1.0.0 on 2026-10-16. Site observations are limited to the accessed public pages; proposed architecture, thresholds, defaults, test targets, and internal names in this document are our design decisions, not published NetBet requirements. Recheck supported dependency patches and relevant policy documents when implementation begins.

| Ref | Source | Supports |
| --- | --- | --- |
| R01 | [NetBet go entry point](https://go.netbet.com/) | Root redirected to the public www site in this research environment |
| R02 | [NetBet Romania Casino](https://casino.netbet.ro/) | Requested public casino origin |
| R03 | [NetBet Romania Sport](https://sport.netbet.ro/) | Requested public sport origin |
| R04 | [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) | Temporary local-service exposure, limits, testing-only suitability |
| R05 | [Node.js releases](https://nodejs.org/en/about/previous-releases) | Supported LTS baseline and release status |
| R06 | [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) | Schema validation, content-type behavior, trusted schema definitions |
| R07 | [Playwright Docker guidance](https://playwright.dev/docs/docker) | Browser/container version alignment and sandbox cautions |
| R08 | [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/) | Loopback versus externally published ports |
| R09 | [Your Europe: online privacy and cookies](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/indexamp_en.htm) | Consent and withdrawal context |
| R10 | [EDPB: anonymisation and pseudonymisation](https://www.edpb.europa.eu/topics/ai-and-technology/anonymisation-pseudonymisation_en) | Pseudonymisation is not equivalent to anonymisation |
| R11 | [EDPB Guidelines 2/2023, final publication](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22023-technical-scope-art-53-eprivacy-directive_en) | Reference for technical-scope legal review; no compliance certification |
| R12 | [MDN: sendBeacon](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) | Small keepalive/beacon payloads, lifecycle/delivery constraints |
| R13 | [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) | Cross-origin browser requests, preflight, credential policies |
| R14 | [MDN: getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) | Viewport-relative element geometry |
| R15 | [MDN: Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) | Geometric intersection measurement |
| R16 | [OWASP: SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) | Destination allowlists, redirects, IP validation, DNS rebinding |
| R17 | [PostgreSQL: table partitioning](https://www.postgresql.org/docs/18/ddl-partitioning.html) | Partition keys and unique-constraint limitations |
| R18 | [OWASP: password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | Maintained password hashing and Argon2id guidance |
| R19 | [OWASP: CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Session-bound CSRF protection |
| R20 | [MDN: CSP connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src) | Network destinations controlled by CSP |
| R21 | [PostgreSQL: continuous archiving/PITR](https://www.postgresql.org/docs/18/continuous-archiving.html) | Recovery design reference |
| R22 | [Codex: AGENTS.md instructions](https://developers.openai.com/codex/guides/agents-md/) | Repository instructions and instruction discovery |
| R23 | [MDN: URL](https://developer.mozilla.org/en-US/docs/Web/API/URL) | Parsing origins, paths, and query components; selected-page matcher |
| R24 | [MDN: URLSearchParams.getAll](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/getAll) | Detect multiple values for a query name rather than using only the first |
| R25 | [MDN: History.pushState](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState) | URL/history changes and navigation integration; content readiness remains a host contract |

No private company document was treated as proof of a verified existing analytics architecture. The public websites were not penetration-tested, source-audited, or instrumented. This delivery is documentation for building the application, not the completed application or authorization to install it.
