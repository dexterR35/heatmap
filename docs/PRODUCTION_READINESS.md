# Release decision

**Current: LOCAL_DEMO. Real-site collection and external capture are disabled in code.**

The 0.4.0 acquisition/experiment features are implemented locally. Production also requires a reviewed host unit-token/consent adapter, backend-only secret storage and rotation, completed-outcome definitions, attribution windows and delayed-event handling, spend/coverage reconciliation, experiment variant deployment and an A/A validation on each integration. The local lab and generated examples establish no real customer acquisition result. Portfolio and per-view reports still have explicit bounded query budgets; validate an appropriate production capacity envelope. See [ACQUISITION_EXPERIMENTS.md](ACQUISITION_EXPERIMENTS.md).

The seven original capabilities and the six analytics upgrades are implemented as a persistent, tested local application (see [analytics upgrade](ANALYTICS_UPGRADE.md)). The supplied 40-section specification defines a substantially larger production program. This repository does not claim that program is finished.

Before a staged or real-data release, complete and evidence:

- Supported Node 24 LTS patch and pinned container validation on approved infrastructure; actual PostgreSQL tests and restore/PITR exercises.
- Separate collector, management and worker runtime accounts with least-privilege grants, plus appropriate process/container and network isolation. The demo uses a single DB account.
- Company-approved OIDC/MFA and remote management entry point, HTTPS cookies and certificates, account lifecycle and permission administration.
- Exact-origin/page approvals, market assignment, public-context readiness, CMP integration, owners, CSP, verified final destination and retention/privacy review for every selected page.
- Public HTTPS collection endpoint with reviewed gateway/edge request limits, infrastructure log minimization, shared multi-replica rate controls, anomaly/incident operations and a measured capacity envelope.
- Configuration lifecycle compatibility across upgrades, stronger schema migrations/rollback tooling, immutable release provenance and dependency/container scanning in CI.
- Production approval of data deletion/export expiry, backup access/encryption/offsite expiry and the implemented operational retention/backup schedules. Validate the implemented worker backoff/failed-job recovery under production faults and load.
- A reviewed non-root browser sandbox and constrained egress before permitting capture of any non-fixture URL.
- Wider adversarial, performance, recovery, accessibility and deployment testing. Current browser evidence covers Chromium only; Safari/Firefox and actual customer integrations are unverified.
- Optional advanced portfolio hierarchy, registry import dry-runs, explicit page groups, live rollout approval records if required for the release scope. Element-relative mapping is now implemented locally.

Do not enable real collection by changing SQL flags. The collector rejects non-synthetic properties independently. Approval is a release decision supported by evidence; this document grants none.

The local security audit and applied fixes are recorded in [SECURITY_AUDIT.md](SECURITY_AUDIT.md). `pnpm verify:links` checks local application routes and generated SDK integrity. It does not verify production DNS, certificates or redirects. No actual production collector/management hostname has been supplied or configured.
