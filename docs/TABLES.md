# Dashboard data tables

The dashboard uses **TanStack Table 9.3.1** with its native `useTable`, feature registration, sorting and pagination row models. All table rows originate from authenticated API results. The tracker, consent rules and source classifications are unchanged.

## Controls and data scope

Landing pages, campaign performance/detail, element engagement and expanded chart-data tables share sortable headers, accessible scrolling, page sizes of 5/10/25/50, first/previous/next/last controls, row ranges and explicit empty/loading/error states. Sorting and search operate on the complete dataset before pagination. Changing sort, search, scope or page size resets the relevant page; datasets that shrink clamp the page to a valid range.

Registry rows come from the complete membership-filtered bootstrap response. Campaign rows come from the full filtered portfolio response; pagination changes the table, while headline totals and charts continue to cover the whole selected cohort. Table search is intentionally local to the table. Element and chart-data tables paginate the full bounded report arrays. Suppressed observations stay unavailable rather than becoming zero.

Campaign responses carry their originating query scope, and superseded requests cannot overwrite newer filters. History requests are aborted on replacement/unmount and render only a response matching the current query/reload key.

## Database history API

Owner-only `GET /api/tables/audit` and `GET /api/tables/operations` return:

```json
{
  "rows": [],
  "pagination": {"pageIndex": 0, "pageSize": 10, "rowCount": 0, "pageCount": 0},
  "snapshot": "2026-10-17T00:00:00.000Z"
}
```

`page` is zero-based. `page_size` accepts 5, 10, 25 or 50. `direction` accepts `asc` or `desc`. `sort` is allowlisted by endpoint: audit accepts `created_at`, `action`, `site_id`; operations accepts `started_at`, `finished_at`, `kind`, `status`. `search` is a literal, case-insensitive substring up to 120 characters. Unknown parameters, duplicate/noncanonical page values, control characters and invalid snapshots are rejected.

The response snapshot is sent back as `as_of` on later pages so newly appended records do not shift an existing history browsing session. Refresh starts a new snapshot. Ordering includes a unique ID tie-breaker and nullable fields sort last. A single SQL statement returns the count and rows from the same database snapshot; out-of-range pages clamp to the final page. All values are bound parameters and SQL identifiers come only from fixed allowlists. Audit rows omit private detail payloads.

Numbered history navigation uses offset pagination with exact filtered counts. Deep history pages still require database work proportional to matching history; this is not a cursor-stream performance guarantee. The cutoff is an inclusive millisecond timestamp. Rows inserted later with an equal/earlier timestamp, backdated inserts and historical edits are not frozen across requests. The older `/api/audit` and operations status endpoints retain their response shape for compatibility; the visible history tables use the complete paginated endpoints.

## Verification

Five API integration cases cover totals beyond the old 100-row cap, tied ordering, no duplicate rows across pages, explicit timestamp boundaries, literal wildcard/SQL-like search text, empty and out-of-range pages, nullable sorting, authentication/RBAC and strict query bounds. The timestamp test uses distinct fixture times rather than assuming sequential requests consume a whole millisecond. Browser acceptance checks exercise client pages over twelve isolated registry records, search from a later page, actual history API pages/IDs, empty search, disabled pagination boundaries, keyboard interaction and mobile overflow. Acceptance data lives in disposable storage, separate from the workstation's recorded activity.

The 0.4.0 registry, acquisition, experiment, exploratory device/guardrail and shared-element tables also use the existing TanStack controls. Their datasets retain the relevant page/campaign/context denominators. Backend callback identities and integration secrets are never table columns. The acquisition and experiment guide describes privacy suppression, source selection, query budgets and cost availability.

Reference: [TanStack pagination](https://tanstack.com/table/latest/docs/framework/react/guide/pagination), [controlled table state](https://tanstack.com/table/latest/docs/framework/react/guide/table-state).
