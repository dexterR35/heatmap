# Local application security audit · 2026-10-16

Decision: **LOCAL_DEMO; production release remains blocked.** This is a source review and targeted local adversarial test pass, not an independent penetration test or a certification. Tests use synthetic accounts, fixtures and local endpoints. No external NetBet properties were scanned, instrumented or captured.

## Findings and corrections

| Finding | Assessment | Correction |
| --- | --- | --- |
| Inherited object names passed an unknown-query allowlist | Medium: `toString`/`constructor` could broaden selected-page scope. This was not evidence of code execution or prototype mutation. | Own-property checks; dangerous names and URL control characters rejected; regression cases cover parser ambiguity. |
| Idle-expired session prevented fresh login CSRF setup | Medium: affected local authentication availability. | Apply identical idle and absolute checks when reading CSRF; issue a fresh pre-login token; clear stale browser session cookie. |
| Unsigned pre-login double-submit cookie | Defense in depth; no cross-origin exploit demonstrated with existing exact Origin checks. | Maintained cookie-plugin signatures, ten-minute signed issuance time, constant-time token comparison; session hash storage retained. |
| Missing strict management query/selector checks | Low: malformed origins could raise server errors; invalid dates could normalize silently. | Reject unknown/duplicate filters, impossible calendar dates, malformed origins/paths and unsafe selector constants. SQL values remain parameterized. |
| Reference bytes read before membership authorization | Low: authenticated unauthorized requests could cause unnecessary storage reads. Bytes were checked before being returned. | Perform property authorization before opening the image file. |
| Permissive image/base64 parsing | Defense in depth. | Canonical base64; PNG/WebP signatures before decoding; reject corrupt/animated images; pixel/byte/concurrency/import-rate caps; metadata-free PNG output. |
| Hidden paths received an SPA fallback | Low: `/.env` returned the public app shell, without file contents. | Explicit 404 for dot paths and encoded-dot variants. |
| Hardcoded demo link and weak endpoint configuration checks | Low: overridden local ports/origins could produce a stale UI link. | Serve the configured demo URL; validate absolute origins and ports; allow HTTP only on loopback; validate bootstrap artifact name, SHA-384 format and collector origin before loading. |

## XSS and injection review

Dashboard labels, selector previews, errors and installation snippets use React text rendering. User content is not inserted as HTML. The remaining constant demo `innerHTML` assignment was replaced with text/DOM operations. Script-context JSON escapes HTML delimiters and Unicode line separators. URI schemes and selected-page origin/path/query constraints are validated separately. Arbitrary SVG/HTML uploads are rejected before image parsing. Images are privately served as PNG with `nosniff`; generated storage keys prevent user-controlled paths.

Chromium regression probes inject HTML image handlers, SVG handlers, script terminators and JavaScript-link markup into a simulated stored label response. They verify literal text rendering, absence of injected DOM nodes, no probe execution/dialogs, and rejection of unsafe installation URLs. This exercises the display boundary without persisting attack fixtures into the user's database. SQL-shaped request filters, unknown sensitive event fields, cross-origin requests and unauthorized property access are also tested.

CSP permits scripts only from the dashboard origin, denies frames and base overrides, and restricts connections to self. It supplements text encoding; the probes check DOM structure as well as execution. HTTPS configurations send HSTS, while Secure cookies depend on the configured HTTPS origin. Loopback HTTP does not verify the production TLS path.

## Reproducible evidence

- `pnpm test:security`: focused HTTP, URL, upload and authentication regressions.
- `pnpm test`: all unit/integration/recovery suites.
- `pnpm test:e2e`: Chromium behavior, consent and XSS probes.
- `pnpm verify:links`: local dashboard/demo/collector, authenticated installation/report/image links, immutable SDK bytes/SRI, CORS and blocked real installs. Output: `.local/evidence/link-check.json`.
- `pnpm typecheck`, `pnpm build`, `pnpm release:check`.
- `pnpm audit --prod --json` and `pnpm audit --json`: **zero reported known advisories** at this audit checkpoint, including development dependencies. Advisory databases cannot prove absence of vulnerabilities.

Initial checkpoint: 80 automated tests, 14 Chromium checks and 12 local link checks passed. The deeper review below subsequently found issues those tests did not cover. Passing tests do not establish absence of hidden vulnerabilities.

## Deeper review and reproduced findings

| Finding | Local reproduction and impact | Fix |
| --- | --- | --- |
| Encoded API path bypassed the raw-prefix security hook | POST `/%61pi/auth/logout` with a session cookie skipped Origin/CSRF checks and revoked the session. This did not grant arbitrary authenticated API reads; those handlers separately require the authenticated user. Same-site localhost services on another port are a relevant threat. | Apply security policy using the router's matched route, reject non-origin-form targets and test encoded paths with cross-origin and invalid-token requests. |
| Installer/reference review permissions were too broad | An installer assigned to a site received image bytes. A viewer received pending-review image bytes/manifests. Property membership alone did not enforce the role/review boundary. | Deny installer image access; restrict unreviewed images, manifests and capture-job status to owner/administrator roles. Filter approved references in SQL before pagination for report readers. |
| Event receipt was not bound to its original view | Reusing an identical event in a different view returned success and inserted an empty view without advancing event quotas. | Compare both original view ID and event hash; reject the conflict and roll back the new view. Existing same-view retries remain idempotent. |
| Crash on final claimed worker attempt left a permanent lease state | An expired processing lease with five attempts remained processing indefinitely. | Transition exhausted pending/expired leases to failed before claiming new jobs. |
| Dynamic sensitive boundaries did not invalidate exposure qualification | Code review found that an initially public element stayed in the observer registry after becoming private, ignored, editable or part of a form. | Recheck connectivity and current privacy ancestors on every exposure qualification. Four controlled-clock Chromium tests cover all boundaries. |

The first five adversarial HTTP/queue/ingestion assertions failed against the earlier implementation and passed after the fixes. The privacy tests run against the actual SDK in an isolated browser fixture. No external property was tested or enabled.

The deeper pass also corrected data provenance. New collector activity is tagged `recorded` by the server; seed generation is tagged `seeded`. Earlier mixed rows are preserved as `legacy`, because their origin cannot be reliably reconstructed. Clients cannot submit a data-source override in the event contract. Recorded means validated collector traffic; it is not cryptographic proof of a human visitor or of a CMP callback. Fractional viewport dimensions are rejected so reports cannot be steered into unselectable viewport filters. Reports and exports default to recorded activity, while the dashboard clearly separates all three sources. Browser acceptance tests now use a disposable database, credentials and loopback ports, so automated clicks do not pollute the user's records or alter their privacy switches.

Current verification: **88 automated tests across 12 files, 19 Chromium checks, and 12 local link checks passed**. The browser recording check verifies consent → actual CTA click → collector 204 → persisted report increase → nonempty heatmap pixels and the visible click counter. Its evidence is `.local/evidence/recorded-clicks-verified.png`. This evidence comes from the isolated acceptance fixture, not a real customer traffic claim. Type checking, asset build and release checks pass. See `IMPLEMENTATION_STATUS.md` for the chronological checkpoints.

## Production blockers and real links

The only verified running URLs are the local configured origins. A real landing page cannot send visitors' events to `127.0.0.1`: that address points to each visitor's computer. No production collector hostname or approved management hostname was supplied, and no DNS, certificate, proxy, production redirect chain or host CMP integration has been verified. Registered real URLs are disabled selector records, not proof of reachable final rendered content. The public collector rejects real environments independently of database flags.

Before any production release, provide and verify the actual HTTPS collector and private management origins, exact final landing URLs after redirects, allowed page selectors, CMP/context integration and release approvals. Complete OIDC/MFA, deployment accounts/network isolation and PostgreSQL role/TLS/restore validation. Add shared edge limits and measured load/memory limits; current source rate counters and upload concurrency are per-process. External screenshot capture needs a reviewed browser sandbox and egress policy. See `PRODUCTION_READINESS.md` for remaining gates.

## Primary guidance used

- [OWASP XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html): context-aware output encoding and safe DOM sinks.
- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html): signed pre-login double-submit protection alongside Origin validation.
- [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): fixed destination restrictions and controlled egress.
- [Fastify hook lifecycle](https://fastify.dev/docs/latest/Reference/Hooks/): request authentication policy belongs before body processing and route execution.
- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): validate permissions at each protected resource boundary.

## Analytics additions · 2026-10-17

The additive diagnostic schema accepts registered generic codes, bounded numeric metrics and related click IDs; raw messages, stacks and other unknown properties are rejected. Campaigns are registered static codes. New reporting and version routes preserve site membership checks; operations remain owner-only behind Host/Origin/session/CSRF validation. Backup verification checks database/reference hashes, refuses existing destinations and expires only checked scheduler-owned folders. Diagnostic overlays reapply masks and reject unsupported visual offsets.

The current suite includes 103 unit/integration checks and 20 Chromium checks, plus an actual local-data preservation/backup check. Both dependency audits report zero known advisories at this checkpoint. These are scoped checks, not a claim of no undiscovered defects. See [the analytics guide](ANALYTICS_UPGRADE.md) for collection definitions and infrastructure limits.

## Chart data projection checkpoint · 2026-10-17

Charts use the existing authenticated report/portfolio routes and inherit source, membership and cohort filters. Real-data daily/device buckets below the privacy minimum remain null/suppressed; absent timing observations stay unavailable. Recharts renders labels/tooltips as React text and loads from local bundled assets. Recharts 3.10.1 and React-matched react-is 19.3.1 are pinned, with updated direct-license inventory. Both installed-graph audits reported zero known advisories. 108 unit/integration checks and 20 Chromium checks passed, including chart controls, keyboard tooltips and zoom. No new production deployment or tracking scope was enabled.
