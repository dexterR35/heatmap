# Threat model and security limits

The supplied spec is the target architecture; this implementation is a local synthetic release. The targeted source review and local security test pass are recorded in [SECURITY_AUDIT.md](SECURITY_AUDIT.md); no independent penetration test or production approval is claimed.

| Threat | Implemented controls | Residual limit / production gate |
| --- | --- | --- |
| Accidental whole-site collection | Exact origin/path/query matcher; independent host manifest; consent/context gate; current server page approval; no fallbacks | Host adapter must reliably invalidate sensitive contexts; browser claims are forgeable |
| Query/data leakage | Client-only URL matching; rejected unknown event fields; stable registered IDs; no visitor URL/text/form content | Operators must register only reviewed public constants; infrastructure logging needs review |
| Cross-origin ingestion | Exact Origin-to-site checks, explicit noncredentialed CORS preflight, one origin per site | Origin and site keys are not authentication; non-browser traffic can forge them |
| Ingestion abuse | 32 KiB body and 50-event caps; source/site/view rate limits; atomic daily quota; 20,000-event per-view ceiling; no trusted forwarded headers | Source counters are per-process; edge/shared rate controls and load testing remain pending |
| Duplicate / poisoned data | Transactional receipts, payload/context hash conflicts, immutable view context, allowed release/element/action checks | Browser traffic is never a guaranteed business-event ledger |
| Management CSRF / DNS rebinding | Expected Host and Origin, signed expiring pre-login cookie, session CSRF, SameSite Strict HttpOnly host-only cookies | HTTP non-Secure cookie is loopback-only; corporate HTTPS/OIDC/MFA is pending |
| Account compromise | Standard Argon2id (19 MiB, 2 iterations), random opaque sessions stored hashed, idle/absolute expiry, login limits, no default password | Work-factor benchmarking, account lifecycle and recovery policy remain pending |
| Cross-property access | Owner policy plus explicit site memberships; scoped reports, exports, references and page edits | Full management UI for user/membership administration is not implemented |
| Screenshot execution / SSRF | Only fixed synthetic loopback capture; minimal child environment; blocked external requests; manual import | No external capture sandbox or public capture endpoint; do not remove restriction |
| Unsafe screenshot data | Canonical base64, PNG/WebP signatures, bounded nonanimated decoding, metadata stripping, masking, SHA-256, membership before storage access | A reviewer must still verify that a manual screenshot is approved public content; concurrency limits are per process |
| Stored / reflected XSS | React text rendering, safe DOM operations, script-context JSON escaping, strict URL/selector schemas, CSP and nosniff | Local Chromium probes cover selected payloads; future rich HTML features need their own review |
| Wrong map alignment | Exact page/release/viewport width/document-height checks; fixed/sticky/zoom exclusions; visible coverage | Element overlay shows registered bounds/exposure; alternate element-relative hotspot mapping is not implemented |
| Durable data loss | Transaction-before-204, persisted queue, idempotent facts, persistent local DB, logical backup/empty-target restore | Docker/PostgreSQL durability, role separation, disk faults and production restore exercise are unverified |

There is no session replay, DOM recording, tracking cookie, customer identity stitching, keystroke collection, financial analytics or third-party analytics product. Synthetic fixtures are visibly labeled. No live registration/deposit completion is inferred from CTA clicks.

Production database roles are not separated in the supplied demo Compose profile. Native mode combines collector, management and worker in one application process. Independent PostgreSQL service entry points are available but their deployed isolation and role grants are unverified. Do not expose the local profile to public networks or label it production approved.
# Acquisition ledger addition · 0.4.0

The original memory-only identity boundary still applies to the SDK. The separate acquisition integration now retains site-scoped hashes of host-owned random unit tokens, consent/assignment records and backend outcomes under the raw-data retention policy. No cross-site identity or form content is collected. Integration keys are backend-only, hashed at rest, revocable and scoped to one website. Collector acquisition routes reject browser Origin headers, strict schemas reject extra fields, and real-site collection remains independently blocked. Protect unit hashes and backups as retained private data. The host is responsible for approved consent, stable random tokens, actual rendered variants, truthful outcome confirmations and withdrawal forwarding. A valid key does not establish accuracy of the caller's business data.

Synthetic lab routes are deliberately limited to the known local demo site/pages and exact loopback Origin. They provide no real customer integration. Generated historical examples are source-separated and never establish a real experiment winner. Frozen aggregate results remain distinct from retained personal evidence. PostgreSQL role isolation, external penetration testing, host consent validation, public HTTPS infrastructure and production throughput are still unverified.

