# Consent and host-context contract

Three independent gates are required: explicit analytics consent, a locally matched selected URL with an eligible anonymous public context, and an enabled server-approved synthetic policy. The local manifest is an upper bound; remote configuration cannot broaden it.

`InfraredHost.setConsent('unknown' | 'granted' | 'denied')` is driven by the host CMP subscription. `setContext({eligible,pageKey,revision,locale,variant,state})` is driven by the actual application/router. The custom events `infrared:consent` and `infrared:context` accept those same values as `CustomEvent.detail`.

The included demo CMP is intentionally fictional. It stores no consent cookie and asks on every new document. It cannot be used as a claim about any customer's CMP, authentication, jurisdictions or company policy.

The bridge serializes async loader work with a generation counter. The SDK has its own lifecycle generation and AbortController. Withdrawal, navigation and context replacement invalidate pending callbacks. Queries are matched on the client, never sent to the collector for matching. SDK capture and transport each recheck permission.

The bridge watches pushState, replaceState and popstate. Leaving the current selected page immediately marks the context ineligible. Matching the next selected page does not establish render readiness: the host must provide its new context. A host-owned call must also invalidate eligibility before sensitive overlays appear at an unchanged URL.

Global Privacy Control and `doNotTrack=1` disable collection as project preferences. They are not described as universal legal requirements. No player state, identity, age, account cookie or vulnerability is inferred.

Private regions exclude entire subtrees and clicks intersecting their visible rectangles. Forms/editable controls and ignored ancestors are excluded. Reference imports are re-encoded and masked. Manual references require review; they must depict anonymous public content only.

The event store remains potentially personal data. Memory-only random IDs and aggregate reports do not establish anonymization. Network infrastructure processes connection metadata; the app uses transient salted source buckets and omits request bodies, cookies, raw IPs, raw referrers and full user-agent strings from application logs.

Limits: pending browser work and in-flight delivery are best-effort; not all requests can be recalled. Browser privacy assertions can be forged by non-browser clients. No production integration has been verified.
