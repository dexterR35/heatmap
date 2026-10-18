# Dependency and runtime inventory

All direct versions are exact in `package.json`; `pnpm-lock.yaml` pins the resolved graph. Install hooks are denied except esbuild's package-local binary check. Argon2 and sharp use their pinned platform packages.

| Layer | Selected implementation |
| --- | --- |
| Runtime | Native validation: Node 26.11.1. Container baseline: Node 24, immutable digest in Dockerfile |
| Package manager | pnpm 11.25.0 |
| Server | Fastify 5.12.7; cookie 11.1.3; static 10.1.6 |
| Contracts | TypeBox 0.34.52; Ajv 8.20.0; ajv-formats 3.0.1 |
| PostgreSQL driver | pg 8.23.1 |
| Embedded PostgreSQL-compatible local database | PGlite 0.5.10, persistent filesystem |
| Password hashing | @node-rs/argon2 2.2.2, standard Argon2id |
| Dashboard | React / React DOM 19.3.1; Vite 8.3.4 |
| Icons | lucide-react 1.57.0 |
| Analytics charts | Recharts 3.10.1; react-is 19.3.1 matched to React |
| SDK | esbuild 0.28.2; repository-owned matching/capture/transport logic; no runtime library dependency |
| Image validation | sharp 0.35.5 |
| Metrics | OpenTelemetry API 1.9.1; SDK metrics 2.12.0; OTLP/HTTP metrics exporter 0.223.0 |
| TypeScript tooling | TypeScript 7.0.2; tsx 4.23.15 |
| Tests | Vitest 5.0.5; Playwright 1.64.1 with its paired Chromium 1248 |
| Container DB | Official PostgreSQL 18-alpine image, immutable digest in Compose; not executed locally |

License details for the pinned installed packages are generated in `DEPENDENCY_LICENSES.json`. This is an inventory, not legal approval. Production review must include transitive and container licenses, vulnerabilities and provenance.

At the 2026-10-17 analytics checkpoint, `pnpm audit --prod --json` and `pnpm audit --json` reported zero known advisories for production and full installed dependency graphs. This is a point-in-time package-audit result, not a security certification or container scan.

Primary documentation consulted:

- [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) — strict request validation; this repository explicitly disables coercion and silent additional-field removal.
- [PGlite filesystem persistence](https://pglite.dev/docs/filesystems) — native filesystem-backed storage used for a runnable local mode without Docker.
- [Node release schedule](https://github.com/nodejs/Release) — Node 24 container baseline.
- [Playwright browser installation](https://playwright.dev/docs/browsers) — pinned package/browser pairing for the fixture runner and browser acceptance tests.

No external analytics service, AI runtime, heatmap engine, replay library or paid hostname is required. No runtime CDN/fonts are used.
