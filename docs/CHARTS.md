# Interactive analytics charts

The dashboard uses **Recharts 3.10.1**, with React/React DOM and `react-is` all at 19.3.1. The chart module loads on demand from the local dashboard server. There is no chart CDN or third-party browser request, and the tracking SDK retains its existing size and transport behavior.

## Available views

| Screen | Charts |
| --- | --- |
| Campaign analytics | Multi-page daily trends; views/click comparison; CTA exposure/ordered activation rates; stacked device-segment counts; experience signals by page |
| Conversion funnels | Daily page-view → CTA exposure → later activation trends; exposure/activation bars per registered element |
| Diagnostics | Daily repeated-click, possible-no-response and generic-error counts; p50/p75/p95 timing trends with metric selection |
| Heatmaps | Scroll reach by document depth; daily views/clicks; mapping outcomes; delivery/retry/delay trends |
| Page comparisons and page versions | Shared date axis, selectable metric, independently scoped cohorts and dashed comparison series |
| Operations | Current durable queue state; service response/error counters since process start |

Campaign and diagnostic trends support lines, bars and area views where appropriate. Campaigns allow up to eight selected pages, defaulting to the first four reportable pages. Series names include page/site labels; the legend toggles individual series. Hover or use keyboard navigation to inspect point values. Date ranges over 14 days provide lower brush handles for zooming. Every chart includes an expandable data table; hidden legend series remain available in that table.

## Data and denominators

- Chart points come from the same authorized, source/date/campaign/device/revision scope as their report. The portfolio includes current page revisions; page-version comparison retains separate revision cohorts. Heatmap charts also follow its selected viewport/mapping scope.
- Calendar days use UTC and have equal spacing. For synthetic/local cohorts, a zero means no tracked observations in that interval. Missing performance measurements are null, never fabricated zeros or interpolated timing samples.
- A real-property chart bucket below the minimum-view privacy threshold is null/suppressed, even if the whole reporting interval is large enough. Lines do not join across null observations. Suppressed pages remain excluded from portfolio charts. The real collector gate is unchanged.
- Tracked page views are not unique people. Device bars count viewport segments, which form a partition; a resized view may contribute several segments. Counts remain unweighted and do not extrapolate sampled traffic.
- Exposure rate divides exposed views by tracked views. Ordered activation rate divides primary CTA activations occurring after exposure by exposed views. A zero denominator is unavailable on the rate chart.
- Daily timing percentiles use observed per-view maxima, with absent days unavailable. Generic errors and click heuristics are investigation signals, not a proof of broken functionality or complete instrumentation.
- Delivery/retry/delay charts refer to selected views, including their other viewport segments. Queue/HTTP charts describe service operations, not visitors. They do not invent historical CPU, latency or queue readings that were never stored.

Recorded activity stays the default. Generated sample traffic and earlier unclassified data remain separate. The real workstation's two recorded views and 42 clicks were preserved; the chart totals matched them without adding browser-test interactions. New timing diagnostics need new consented visits.

## Readability and validation

The white workspace uses dark primary, secondary and helper text, restrained orange accents, and distinct chart colors. Chart axes, legends, tooltips and data tables use the same readable palette. Desktop/mobile views are verified for overflow. The scoped contrast check evaluates solid-background visible HTML text; it is not a full independent accessibility audit or an audit of screenshot content.

Validation includes 108 unit/integration checks and 21 Chromium checks. Coverage exercises UTC spacing, unavailable timing samples, privacy gaps, resize cohorts, diagnostic/delivery aggregation, actual v3 rendering, chart styles, legend toggles, metric selection, data tables, keyboard tooltips, date zoom, progressive disclosure, mobile menus and white-only appearance. Browser fixtures use disposable databases, keeping generated/test interactions out of recorded workstation data.

Primary documentation: [Recharts v3 migration and accessibility](https://github.com/recharts/recharts/wiki/3.0-migration-guide), [responsive chart containers](https://recharts.github.io/en-US/api/ResponsiveContainer/).

## White workspace and focused overview

The workspace and login now use a single light appearance, as requested. Dark mode and its switch were removed. The self-hosted initializer removes the earlier appearance preference and sets light mode before the app paints, without a CSP relaxation or a remote dependency.

The Overview shows three headline metrics, one daily trend chart and a compact landing-page table. More analysis opens the device, CTA, activity and experience comparisons plus detailed campaign metrics. Heatmaps place element engagement, extra charts and data-quality detail in separate disclosures. Methodology notes and chart tables remain available on demand. Suppressed cohorts stay excluded, and a rate with no denominator displays an em dash.

Four primary navigation items lead to Overview, Landing pages, Heatmaps and Funnels. Analysis and Manage expose the remaining screens; URL hashes and browser back/forward navigation remain supported. Mobile navigation retains text labels and closes menus after selection, outside interaction or Escape.

The final visual direction uses a white workspace, charcoal navigation and Inter throughout. The original [Graphoria](https://graphoria.studio/) logo appears without an affiliation byline; its orange is retained as an accent. All fonts and artwork are hosted locally. The user explicitly replaced the earlier cream canvas and condensed headings with dashboard typography. Recharts v3, reference screenshots and heatmap density pixels retain their existing behavior. No tracking or production-release settings changed. Expanded chart-data tables now use the shared [TanStack Table controls](TABLES.md).
