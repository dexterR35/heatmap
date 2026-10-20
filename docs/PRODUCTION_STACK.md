# Infrared production stack

Status: **plan**. Infrared 0.4.0 still runs as a local demo. Items marked **TO BUILD** need code changes before real customer pages can be collected; see §10.

Infrared is a multi-customer SaaS product. Rollout order: **(1)** the owner's own website as the first live test, **(2)** the first customer pilot on selected landing pages, **(3)** further customers.

---

## 1. Stack

```text
 Visitors on customer landing pages (any domain, any market)
        │ HTTPS
        ▼
 Cloudflare (Free) ── DNS · HTTPS · DDoS · WAF rate limit · script cache
        │            └─ Cloudflare Access (company login) on dashboards
        │ Cloudflare Tunnels (outbound-only, encrypted)
        ├──────────────────────────────────┐
        ▼                                  ▼
 PRODUCTION · Hetzner VPS           STAGING · any developer computer
 Ubuntu 24.04 · Docker Engine       Linux · Windows · macOS + Docker
 ┌ docker compose (prod) ────────┐  ┌ docker compose (staging) ─────┐
 │ cloudflared                    │  │ cloudflared                   │
 │ collector · api · worker       │  │ collector · api · worker      │
 │ alloy ──► Grafana Cloud        │  │                               │
 └────────────────────────────────┘  └───────────────────────────────┘
        │                                  │
        ▼                                  ▼
 Supabase "infrared-prod" (EU)      Supabase "infrared-staging" (EU)
```

Both environments run **the same Docker image**, built and tested once by GitHub Actions.

| Layer | Choice | Status |
|---|---|---|
| Backend | Node.js 24 + Fastify 5, TypeScript | EXISTS |
| Dashboard | React 19 + Vite + **Zustand** | React EXISTS, Zustand TO BUILD |
| Tracking script | TypeScript, ~6 KB gzip, SRI-pinned | EXISTS (hardening TO BUILD) |
| Database | **Supabase PostgreSQL**, Free, EU (Frankfurt) | Driver EXISTS, verification TO BUILD |
| Containers | **Docker Engine + Docker Compose** | Demo Dockerfile EXISTS (never run); production image TO BUILD |
| Image registry | **GitHub Container Registry** (GHCR) | TO SET UP |
| Production server | **Hetzner VPS**, 2 vCPU / 4 GB / 40 GB, EU | TO SET UP |
| Staging machine | **Any developer computer**: Linux, Windows or macOS (Intel or Apple Silicon) | TO SET UP |
| Edge and HTTPS | **Cloudflare Free** + **Cloudflare Tunnel** | TO SET UP |
| Staff access | **Cloudflare Access** + **company SSO** (OIDC) | TO BUILD |
| Monitoring | **Grafana Cloud Free** via Grafana Alloy | Metrics EXIST, wiring TO SET UP |
| CI and deploy | **GitHub Actions** | CI EXISTS, image build and deploy TO BUILD |
| Domain | **Own domain** at Cloudflare Registrar; a customer subdomain (e.g. `track.customer.com`) per customer only if they ask | TO BUY |

**Why no Nginx:** Cloudflare Tunnel delivers traffic straight to the containers over a private Docker network. HTTPS certificates live at Cloudflare. No container publishes a port, and the server accepts no inbound web connections.

**Why not Kubernetes:** three services on one server. Docker Compose restarts failed containers and deploys in seconds. The same image can move to Kubernetes later if a customer requires it.

**Deliberately not used:** Nginx, Let's Encrypt, systemd units for the app, Kubernetes, Redis, load balancer, ClickHouse, Kafka. See §11 for when they would be added.

---

## 2. Environments

| | Staging | Production |
|---|---|---|
| Machine | Developer computer (Linux / Windows / macOS) | Hetzner VPS |
| Purpose | Try features and UI on one real test page | Real customer landing pages |
| Available | While the laptop is on | 24/7 |
| Dashboard | `https://staging-heatmap.<domain>` | `https://heatmap.<domain>` |
| Collector | `https://staging-track.<domain>` | `https://track.<domain>` |
| Database | Supabase `infrared-staging` | Supabase `infrared-prod` |
| Compose file | `compose.staging.yml` | `compose.prod.yml` |
| Image | any tag, or built locally | release tag from GHCR (`infrared:1.0.0`) |
| Cloudflare Tunnel | `infrared-staging` | `infrared-prod` |

### Developer loop on the laptop
1. **UI and feature work:** Vite dev server with instant reload, outside Docker (TO BUILD, `pnpm dev:ui`).
2. **Automated tests:** `pnpm test`, `pnpm test:e2e`.
3. **Staging:** `docker compose -f compose.staging.yml up --build`; open the test page and the staging dashboard through the tunnel.
4. Push to GitHub. CI tests and builds the image, and production deploys after approval.

---

## 3. Domain and Cloudflare

### Domain
Buy a `.com` (or `.eu`) at **Cloudflare Registrar** (~$10/year). Choose a neutral name. Words like "track" or "analytics" in the root domain are blocked more often by ad blockers.

*Per-customer option:* a customer can point its own subdomain (e.g. `track.customer.com`) at Infrared; switching only requires updating that customer's install snippet.

### Tunnels
Zero Trust → Networks → Tunnels: create **two** tunnels and copy each token into its environment's `.env`.

| Tunnel | Public hostname | Service (Docker network) |
|---|---|---|
| `infrared-prod` | `track.<domain>` | `http://collector:8080` |
| `infrared-prod` | `heatmap.<domain>` | `http://api:3000` |
| `infrared-staging` | `staging-track.<domain>` | `http://collector:8080` |
| `infrared-staging` | `staging-heatmap.<domain>` | `http://api:3000` |

### Cloudflare settings
- **SSL/TLS:** Always Use HTTPS on, minimum TLS 1.2. HSTS after go-live.
- **WAF rate limiting rule:** `track.<domain>/v1/events`, block above ~100 requests per 10 s per IP.
- **Bot Fight Mode:** off for `track.` hosts, so real visitors' background requests are never challenged.
- **Cache:** default. `/sdk/v1/*` is `immutable` and cached worldwide; events and config are `no-store`.
- **Cloudflare Access** (Free up to 50 users) on `heatmap.` and `staging-heatmap.`:
  - Identity: your team's Microsoft Entra ID / Google / Okta, or e-mail one-time PIN until SSO is ready.
  - Policy: explicit staff e-mail list or company domain.
  - Never on `track.` hosts.

---

## 4. Machines

### Production: Hetzner VPS
- **Size:** 2 vCPU, 4 GB RAM, 40 GB disk, Ubuntu 24.04, Falkenstein / Nuremberg / Helsinki. Upgrade to 4 vCPU / 8 GB if CPU stays above 60%.
- **Hetzner Cloud Firewall:** inbound **22 only, from the admin IP**; everything else denied. Tunnels need no inbound port.
- **Hardening:**
  - SSH keys only (`PasswordAuthentication no`, `PermitRootLogin no`)
  - `unattended-upgrades` and `fail2ban`
  - a `deploy` user in the `docker` group
- **Install:** Docker Engine + Compose plugin from Docker's official apt repository. Nothing else: Node, cloudflared and Alloy run in containers.
- **Hetzner backups:** enabled (+20% of server price) for the reference screenshot volume.

### Staging: any developer computer

| OS | Container runtime | Licence |
|---|---|---|
| **Windows 10/11**, current staging machine | Docker Desktop (WSL 2 backend), or Rancher Desktop / Podman Desktop | Docker Desktop: free for personal use and small companies, paid for larger companies. Rancher and Podman: free |
| **Linux** (Kubuntu / Ubuntu / Fedora …) | Docker Engine + Compose plugin from Docker's official repository | Free |
| **macOS** (Intel or Apple Silicon) | Docker Desktop, OrbStack, or Rancher Desktop / Podman Desktop | Same as Windows; OrbStack is paid for commercial use |

- The image is built for **both `linux/amd64` and `linux/arm64`** (Docker Buildx in CI), so it runs natively on Intel/AMD PCs, Apple Silicon Macs and the Hetzner VPS.
- Each developer gets the same `compose.staging.yml`. They need their own `.env` with the staging database URL and tunnel token, from the team's password manager, never from git.
- Only one computer should run the staging tunnel at a time, or create one tunnel per developer (`staging-<name>-heatmap.<domain>`).
- For development outside Docker: Node.js 24 and pnpm (version from `package.json`) on any OS.
- Disk encryption on (BitLocker / FileVault / LUKS), because the staging `.env` holds secrets.
- **Windows:** keep the project inside the WSL 2 filesystem (e.g. `\\wsl$\Ubuntu\home\<user>\infrared`) rather than `C:\`, which makes Docker builds and file watching much faster.

---

## 5. Supabase (Free, EU)

1. Create `infrared-prod` and `infrared-staging` in **Frankfurt**.
2. Generate a strong database password and store it only in that environment's `.env`.
3. Connect with the **session pooler** (port 5432, IPv4, works from Docker and home networks) or the direct connection, with `?sslmode=require`. **Never the transaction pooler** (6543): Infrared uses transactions and row locks.
4. Migrations run automatically as a one-shot `migrate` container before the services start.
5. Do not expose Infrared tables through Supabase's Data API. Only the containers connect.

| Free-plan limit (check current Supabase pricing) | Handling |
|---|---|
| ~500 MB database | Raw-event retention (e.g. 30 days, heatmap facts kept); size warning at 80% (TO BUILD) |
| Pauses after ~1 week idle | Production has daily traffic; staging pauses when unused and resumes from the Supabase console |
| No downloadable backups | Infrared scheduled logical backup (EXISTS) + nightly `pg_dump` container, kept off-server |

Move to Supabase Pro when the database passes ~400 MB.

---

## 6. Docker (TO BUILD)

### Image: `infra/docker/Dockerfile`
- **Multi-stage:** a build stage (pnpm install, typecheck, build) and a runtime stage containing only production dependencies and built output.
- Pinned `node:24` slim base by digest; non-root `node` user.
- Read-only root filesystem; writable volume only for `DATA_DIR`.
- `HEALTHCHECK` on `/healthz`.
- One image; the service is chosen by command: `collector`, `api`, `worker`, `migrate`.
- Multi-architecture (`linux/amd64` + `linux/arm64`): the same tag runs on Windows/Linux PCs, Apple Silicon Macs and the VPS.
- Built and scanned in CI, pushed to GHCR as `ghcr.io/<owner>/infrared:<version>` and `:<git-sha>`.

### `compose.prod.yml` (shape)

```yaml
x-app: &app
  image: ghcr.io/<owner>/infrared:${INFRARED_VERSION}
  env_file: .env
  read_only: true
  tmpfs: [/tmp]
  security_opt: [no-new-privileges:true]
  cap_drop: [ALL]
  restart: unless-stopped
  networks: [internal]

services:
  migrate:   { <<: *app, command: migrate, restart: "no" }
  collector: { <<: *app, command: collector, depends_on: { migrate: { condition: service_completed_successfully } } }
  api:       { <<: *app, command: api, volumes: [data:/data], depends_on: { migrate: { condition: service_completed_successfully } } }
  worker:    { <<: *app, command: worker, volumes: [data:/data], depends_on: { migrate: { condition: service_completed_successfully } } }
  cloudflared:
    image: cloudflare/cloudflared:<pinned>
    command: tunnel --no-autoupdate run
    environment: [TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}]
    restart: unless-stopped
    networks: [internal]
  alloy:
    image: grafana/alloy:<pinned>
    volumes: [./alloy.config:/etc/alloy/config.alloy:ro]
    restart: unless-stopped
    networks: [internal]

networks: { internal: {} }
volumes:  { data: {} }
```

No service publishes a port. `compose.staging.yml` is the same with its own `.env`, tunnel token and an optional local `build:`, and without `alloy`.

### `.env` (production)

```dotenv
INFRARED_VERSION=1.0.0
DATABASE_URL=postgresql://postgres.<project>:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require
DATA_DIR=/data
DASHBOARD_ORIGIN=https://heatmap.<domain>
COLLECTOR_ORIGIN=https://track.<domain>
HEATMAP_OTEL_METRICS_ENDPOINT=http://alloy:4318/v1/metrics
CLOUDFLARE_TUNNEL_TOKEN=<from Cloudflare>

# TO BUILD
RELEASE_STATUS=PRODUCTION
TRUSTED_EDGE=cloudflare     # take the visitor IP from CF-Connecting-IP, only for requests from the cloudflared container
OIDC_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
OIDC_CLIENT_ID=<from the identity provider>
OIDC_CLIENT_SECRET=<from the identity provider>
```

**Code changes required:**
- **Visitor IP:** rate limits use the connection IP (`trustProxy:false`, `apps/server/collector.ts:12`, `apps/server/management.ts:27`). Through the tunnel, every request comes from the cloudflared container, so all visitors would share one limit. The app must read `CF-Connecting-IP`, but only from the trusted edge.
- **Metrics endpoint:** the metrics exporter allows plain HTTP only on loopback, so it must also accept the internal `alloy` service name.

---

## 7. Monitoring (Grafana Cloud Free)

**EXISTS:** OpenTelemetry metrics for requests and latency per route, worker throughput, queue size and age, last retention/backup. No visitor data.

- The **Alloy** container receives OTLP from the services on the internal network and forwards to Grafana Cloud (EU) with the stack credentials. Infrared itself holds no Grafana credentials.
- **Alerts:**
  - collector 5xx > 1% for 5 min
  - oldest queued job > 10 min
  - no production events for 2 h in daytime
  - last backup older than 26 h
  - `https://track.<domain>/healthz` down for 2 min (synthetic check)

---

## 8. Users, company login and teams

### Roles and site access (EXISTS)

| Role | Can |
|---|---|
| owner | Everything, including approvals, privacy and operations |
| administrator | Manage sites, pages and installs for assigned sites |
| analyst | Reports, heatmaps and experiments for assigned sites |
| installer | Install snippets only |
| viewer | Approved reports for assigned sites |

Argon2id password hashes. Hashed sessions (1 h idle, 12 h absolute). `HttpOnly` + `SameSite=Strict` + `Secure` cookies. CSRF, Host and Origin checks. Audit log.

### Company login, SSO (TO BUILD)
- **Layer 1, Cloudflare Access:** only approved identities (your team and each customer's users) reach the dashboard.
- **Layer 2, OIDC inside Infrared:** "Sign in with Microsoft / Google / Okta" using the authorization code flow with PKCE.
  - Validates issuer, audience, signature, nonce and expiry.
  - Maps the verified e-mail to an Infrared user. Unknown users from an allow-listed domain are created as `viewer` with no access.
  - Infrared keeps its own roles and access. An optional IdP group can map to a team.
  - One break-glass local owner account for IdP outages.
- **From the identity provider:** app registration (client ID and secret), redirect URIs `https://heatmap.<domain>/api/auth/oidc/callback` (+ staging).

### User management screen (TO BUILD)
Add users by e-mail, set role, assign sites and teams, disable users, revoke sessions, view each user's audit trail.

### Teams by market and product (TO BUILD)
- Tables: `teams`, `team_scopes(market?, product?, site?)`, `team_members`. An empty scope field means "any".
- Examples: **UK Casino** = UK + casino. **Poker** = poker, all markets. **Romania** = RO, all products.
- Every report, export, page list and experiment is filtered **on the server** by the user's team scopes, with tests per route.

### Zustand (TO BUILD)
- A session store (user, role, team scopes) and a filter store (market, product, brand, dates, device, source).
- Filters persist across screens and are mirrored in the URL for sharing.

---

## 9. Release workflow

```text
laptop: feature branch ─► tests ─► staging on laptop (real test page via tunnel)
   │
   └─PR─► GitHub Actions: typecheck · unit · security · browser journeys · build image · scan · push to GHCR
                │
                └─ merge to main + manual approval ─► deploy to Hetzner
```

### Deploy (GitHub Actions over SSH, TO BUILD)
1. Set `INFRARED_VERSION` to the new tag in `/srv/infrared/.env`.
2. `docker compose -f compose.prod.yml pull`.
3. `docker compose -f compose.prod.yml up -d`: migrations run first, then the services restart.
4. Smoke test: `/healthz`, dashboard, SDK hash. On failure, restore the previous `INFRARED_VERSION` and run `up -d` again.

Rollback is the same command with the previous tag. Migrations are additive, so older images keep working with the newer schema.

### Testing
- **Automated (CI):** `pnpm test`, `pnpm test:security`, `pnpm test:e2e`, `pnpm verify:links` (extended to real HTTPS origins, TO BUILD), image vulnerability scan.
- **Load (TO BUILD):** 50k visits/month per page plus campaign bursts; record latency and database growth.
- **Staging, manual:** one test page on desktop and phone; accept and decline consent; click and scroll; check the heatmap; confirm the page loads and behaves exactly as before.
- **Production:** one real page for several days, then the rest.

---

## 10. Code work before go-live

| # | Work |
|---|---|
| 1 | **Security fixes** from the independent review:<br>• remove the `DEMO_ORIGIN` origin rewrite (`apps/server/seed.ts:13-16`)<br>• make the rate limiter impossible to fill (`packages/security/index.ts:17`)<br>• validate host events and isolate navigation hooks (`apps/tracker/bootstrap.ts`)<br>• validate remote config in the SDK; `AbortSignal.any` fallback<br>• CORS on error responses<br>• per-source quotas; config caching<br>Regression test for each. |
| 2 | **Production mode:** replace the `environment='synthetic'` locks (`collector.ts:23`, `ingestion.ts:15`, `acquisition.ts:11`, `management.ts:116,124`, `config/index.ts:13`) with an owner-only, audited approve-and-enable step per site and page, keeping the global stop. The demo pages become test-only fixtures. |
| 3 | `TRUSTED_EDGE` visitor IP, internal metrics endpoint, `RELEASE_STATUS=PRODUCTION`, Supabase verification, database size warning |
| 4 | Consent adapters for common CMPs (OneTrust, Cookiebot, Google Consent Mode, custom events) |
| 5 | Production Dockerfile, `compose.prod.yml`, `compose.staging.yml`, `.env` templates; CI image build, scan, GHCR push and deploy |
| 6 | OIDC company login and user-management screen |
| 7 | Teams by market and product; Zustand filters; `pnpm dev:ui` instant reload |
| 8 | Load test; production link checks |
| 9 | **Organizations (tenants)** for SaaS: each customer is an organization that owns its sites, pages, users, keys, data exports and retention. Customer admins manage only their organization; the platform owner role is separate. Every query is scoped by organization on the server, with cross-tenant access tests. Needed before the second customer, not for the first own-site test |

---

## 11. Add later only when needed

| Add | When |
|---|---|
| Supabase Pro | Database > 400 MB, or a customer requires point-in-time recovery |
| Always-on staging on the VPS | Colleagues need to test while the laptop is off |
| Redis | Two or more collector servers |
| Cloudflare Load Balancing | Two or more servers |
| Kubernetes | A customer requires it, or traffic needs many servers |
| ClickHouse | Tens of millions of events per month, or slow reports |
| Kafka | Very large bursts across many collectors |

---

## 12. Cost per month

| Item | Cost |
|---|---|
| Hetzner VPS (+ backups) | ~€6–10 |
| Staging (developer computers) | €0 (Docker Desktop may need a paid licence on Windows/macOS for larger companies) |
| Supabase Free ×2 | €0 |
| Cloudflare Free, Tunnels, Access (≤ 50 users) | €0 |
| Grafana Cloud Free | €0 |
| GitHub + GHCR | €0 (private repo free tiers) |
| Docker Engine | €0 |
| Domain | ~$10/year |
| **Total** | **≈ €7–11** |

---

## 13. Needed from each customer

- [ ] OIDC app registration (Entra ID / Google / Okta) and allowed staff
- [ ] Consent platform name and analytics category
- [ ] CSP on landing pages: allow `https://track.<domain>` in `script-src` and `connect-src`
- [ ] A test landing page for staging (e.g. `?lp=infrared-test`)
- [ ] Owner per market for page approvals
- [ ] DPO approval:
  - suppliers: Hetzner, Supabase, Cloudflare, Grafana, all EU regions
  - data: no cookies, form values, URLs or text; memory-only view IDs; minimum-volume suppression; retention period
