# Infrared by Graphoria — What It Does

**See the clicks. Understand the experience.**

Infrared is a private analytics workspace for marketing teams that run campaign landing pages. It shows where visitors click, how far they scroll, which calls to action they actually see, and which pages, campaigns and variants bring in registrations and customers. It does this on only the exact pages you choose, only after the visitor agrees, and without following anyone across the web.

This document covers what Infrared can do. It explains features only, with no technical detail.

---

## Contents

1. [In one minute](#in-one-minute)
2. [Who it is for](#who-it-is-for)
3. [The workspace: every page explained](#the-workspace-every-page-explained)
4. [Heatmaps in depth](#heatmaps-in-depth)
5. [Markets, products and brands](#markets-products-and-brands)
6. [Funnels and conversion](#funnels-and-conversion)
7. [Acquisition and spend](#acquisition-and-spend)
8. [Experiments: A/A and A/B testing](#experiments-aa-and-ab-testing)
9. [Experience diagnostics](#experience-diagnostics)
10. [Charts, tables and exports](#charts-tables-and-exports)
11. [Privacy](#privacy)
12. [Security](#security)
13. [Speed and lightness](#speed-and-lightness)
14. [Data you can trust](#data-you-can-trust)
15. [Testing and verification](#testing-and-verification)
16. [Maintenance, backup and recovery](#maintenance-backup-and-recovery)
17. [Team roles and access](#team-roles-and-access)
18. [What Infrared deliberately does not do](#what-infrared-deliberately-does-not-do)
19. [Current release status](#current-release-status)

---

## In one minute

- **Visual heatmaps** of clicks, scroll depth, element engagement, repeated clicks and clicks that got no response, drawn over a real screenshot of your page.
- **Campaign overview** comparing all your landing pages side by side.
- **Funnels** from page view, to the main button being seen, to the main button being clicked.
- **Acquisition reporting** with confirmed registrations, qualified customers, daily spend and cost per acquisition.
- **Built-in A/B and A/A testing** with honest statistics and a frozen final result.
- **Market, product and brand filters** across the whole workspace.
- **Link and pixel checks** that confirm whether a landing page loads and whether the tracking code is present.
- **Experience diagnostics:** load speed, layout stability, error signals and frustration hints.
- **Privacy built in:** consent first, no cookies, no form contents, sensitive areas masked, emergency stop switch.
- **Owner tools** for scheduled maintenance, verified backups, alerts and a full audit trail.

---

## Who it is for

| Person | What they get |
| --- | --- |
| **Marketing managers** | Which landing pages, campaigns and markets perform, and where visitors drop off |
| **Campaign and performance teams** | Cost per acquisition, campaign comparisons and a reliable way to test new versions |
| **Designers and copywriters** | Where people click, what they never scroll to, and whether a button is ever seen |
| **Analysts** | Clean, separated data with clear definitions, confidence intervals, data tables and exports |
| **Compliance and privacy officers** | Consent gating, no personal identifiers, masking, retention rules and an audit trail |
| **Workspace owners** | Users, maintenance, backups, alerts and an emergency stop |

---

## The workspace: every page explained

The workspace has a clean white layout with a dark sidebar. Navigation is grouped into **main pages**, **Analysis** and **Manage**. It works on desktop, tablet and mobile, and the browser's back and forward buttons work as expected.

### Sign-in

A private, password-protected entry to your own workspace. There is no public access and no default password. Repeated wrong attempts are slowed down.

### Main pages

#### 1. Overview (Campaign analytics)
The home page for the whole portfolio.
- Three headline numbers, one daily trend chart and a compact table of your landing pages.
- Compares pages by tracked views, clicks, how often the main button was seen, how often it was clicked after being seen, scroll reach and experience signals.
- Filter by date, device, data source, campaign, market, product and brand.
- Compares up to eight pages at once; the four strongest pages are selected by default.
- **More analysis** opens device breakdowns, button performance, daily activity and experience comparisons, plus a detailed campaign table.

#### 2. Landing pages
The list of every page you track.
- Shows how many pages exist, how many are enabled and how many are waiting for approval.
- Search by name or address.
- Turn collection on or off for each page.
- **Add landing page** takes one exact page address. The page is saved as a disabled draft until it is approved.
- **Check link & pixel** runs directly from this list.
- One click on a page opens its heatmap.

#### 3. Heatmaps
The visual heart of Infrared. See [Heatmaps in depth](#heatmaps-in-depth).

#### 4. Funnels
The step-by-step path from landing to action. See [Funnels and conversion](#funnels-and-conversion).

### Analysis

#### 5. Acquisition
Registrations, qualified customers, spend and cost per acquisition by market and landing page. See [Acquisition and spend](#acquisition-and-spend).

#### 6. Experiments
Create, run, pause, close and read A/A and A/B tests. See [Experiments](#experiments-aa-and-ab-testing).

#### 7. Diagnostics
Speed, stability, error signals, repeated clicks and unresponsive clicks, with a **"Worth a closer look"** shortlist. See [Experience diagnostics](#experience-diagnostics).

#### 8. Comparisons
Two landing pages side by side.
- Tracked views, activation rate and scroll reach for each page.
- Daily trend charts on a shared date axis.
- **Shared-scale heatmap comparison:** both maps use the same colour scale, so a hotter area really means more activity. You can compare raw clicks or clicks per 1,000 views.
- Each page keeps its own visitors and layout. Maps are never merged.

#### 9. Page versions
Before-and-after comparison of two releases of the same page.
- Each version keeps its own visitors and its own screenshot.
- If only one version has been seen, Infrared says so and does not invent a second one.
- Publishing a new version never changes the records of the old one.

#### 10. References (screenshot library)
The page layouts that heatmaps are drawn on.
- **Capture selected page:** take a screenshot of a page at a chosen width (for example desktop 1440 px or mobile 390 px).
- **Import an approved public layout:** upload your own screenshot.
- Every screenshot waits for **review and approval** before it is used.
- Private areas are blacked out automatically, and hidden image information is removed.
- Each screenshot carries a fingerprint, so tampering is easy to detect.
- **Reference history** lists every screenshot and its review status.

### Manage

#### 11. Markets & registry
The master list of markets, websites and page families.
- Edit page details such as market, product, brand, language, currency, time zone, page family and acquisition goal.
- **Import or update landing pages** in bulk. Infrared checks the batch, shows errors row by row and shows exactly what will change. The batch is then applied all at once or not at all.
- **Export** the registry for review or reuse.
- **Link & pixel verification** for every page.

#### 12. Installation
Everything Marketing needs to put Infrared on a page.
- A ready-made script that only runs on the exact page selected.
- A four-step handoff: choose the exact campaign template, connect consent, review security, test the boundaries.
- A clear **Included / Not included** list, so nobody tracks the wrong page by accident.
- Instructions for marking sensitive areas as private.
- **Approved campaign and diagnostic policy:** register approved campaign codes, choose the main button and action, set the published version and turn diagnostics on or off.
- Installation status and link and pixel checks.

#### 13. Data quality
A health report for your data.
- Total stored events, tracked views, unresolved views and processing backlog.
- Collection boundaries: whether live collection and external capture are on, and which time zone is used.
- Recent rejected requests by reason.
- **Can you trust this cohort?** Mapping coverage, sampling, processing freshness and late arrivals.
- **Workspace audit trail:** every configuration change, screenshot review and export, with its time.

#### 14. Operations (owners only)
The control room.
- **Scheduled maintenance:** automatic daily data clean-up and optional automatic backups.
- **Checks and recovery:** run clean-up, backup or a health check on demand.
- **Operational alerts:** failed processing, processing delays, too many rejected requests, failed or overdue backups.
- **Maintenance history** with search and sorting.
- **Service telemetry:** current processing queue and service response counts.

#### 15. Privacy & settings
- How long raw data is kept (1–90 days, 30 by default).
- How long screenshots are kept (1–365 days, 90 by default).
- The minimum audience size before real data is shown (20–100 views).
- **Global emergency stop:** stops collection on every page immediately. When collection is restored, each page keeps its own on/off setting.

---

## Heatmaps in depth

### Five heatmap modes

| Mode | What it shows |
| --- | --- |
| **Clicks** | Where visitors click, as a glowing density map over the page |
| **Scroll reach** | How far down the page visitors get, at each depth |
| **Elements** | How often each registered element (buttons, banners, offers) is seen and clicked |
| **Repeated clicks** | Places where people click quickly several times in a row, a possible sign of frustration |
| **No response** | Clicks on buttons or links that produced no visible reaction, a possible broken element |

### Heatmap controls
- **Opacity slider** to fade the heatmap in and out over the screenshot.
- **Show or hide the screenshot** to look at the heat on its own.
- **Screenshot picker** to choose exactly which approved layout to analyse.
- **Fit to width** for comfortable viewing.
- **Export annotated PNG**: download the heatmap image with its labels.
- **Export aggregate CSV**: download the numbers behind the map.

### Live numbers beside the map
- **Tracked page views:** consented, sampled views.
- **Pointer clicks:** every click, including repeated ones.
- **Average scroll reach:** how far down the page visitors got.
- **Page activation rate:** the share of views where the main action happened.
- **At a glance:** activated views, how often the main button was properly seen, the activation rate after it was seen, and average visible time.
- **Scroll reach bars:** the share of visitors reaching 25%, 50%, 75% and 100% of the page.
- **Map coverage:** how many clicks could be placed on the map and how many were left out, with the reason.

### Two ways to place clicks
1. **Exact page layout:** clicks are placed on the exact screenshot of the same width. Floating or zoomed elements are left out so nothing is misplaced.
2. **Registered elements:** clicks inside a known button or banner are placed in the same spot on that element across desktop, tablet and mobile layouts.

### Element engagement table
For every registered element, the table shows how many views saw it, how many views clicked it, and the click rate among views that saw it.

### Why Infrared heatmaps are accurate
- A heatmap is only drawn on a screenshot that matches the page version, language, variant and exact width.
- When no matching screenshot exists, Infrared says so instead of drawing a misleading map. The numbers stay available.
- Private areas are masked again after every click is placed.
- Version maps have independent colour scales. Comparison maps share one scale.
- The page refreshes every few seconds, so new clicks appear almost live.

---

## Markets, products and brands

Infrared is built for teams that run many campaigns across several countries and products.

- **Markets:** each website carries its market, language, currency and local time zone (for example United Kingdom on London time, Romania on Bucharest time).
- **Products:** pages are labelled Casino, Sport or Campaign.
- **Brands and page families:** related pages are grouped for portfolio reporting.
- **Acquisition goals:** each page records what it is meant to achieve.
- **Filters everywhere:** Market, Product and Brand filters work on the registry, landing pages, Overview, Acquisition and Experiments.
- **Exact page identity:** a page is defined by its exact address and campaign code. A different campaign on the same site is a different page.
- **No guessing:** market and location are never guessed from visitor addresses. They come only from your registry.
- **Currencies are never mixed:** spend and cost totals are kept separate per currency.
- **Bulk management:** import and export the whole registry, check it row by row, and apply it all at once.
- **Link & pixel verification per page:**
  - **Page loads:** the exact page answered successfully.
  - **Blocked:** the site refused the check, so the pixel cannot be confirmed.
  - **Pixel code detected:** the tracking code was found on the page.
  - **Pixel not found:** no tracking code was found in the page source.
  - **Receiving events:** real activity arrived in the last 24 hours.
  - **Draft:** collection is turned off for this page.
  - Response timings are shown for each check, and results are kept after the page is reloaded.

---

## Funnels and conversion

The **Funnel** page follows three ordered steps inside each visit:

1. **Page view:** the visitor arrived and agreed to analytics.
2. **Main button seen:** at least half of the main call-to-action was on screen for at least one second.
3. **Main button clicked:** the same button was clicked *after* it was seen.

What makes the funnel trustworthy:
- **Order matters.** A click before the button was seen, or a click on a different button, does not count as completing the funnel.
- **Confidence range:** the activation rate comes with a 95% confidence range, so you know how certain the number is.
- **Small-sample warning:** groups under 20 views are flagged.
- **Time to first action:** the median time until a visitor first clicks the main button.
- **Engaged visits:** a click, at least 10 seconds of visible time, or at least 75% scroll.
- **Quick exits:** visits shorter than 10 seconds with no main action.
- **Daily funnel trends** and **per-element exposure and activation bars**.
- Registrations and revenue are **never guessed** from clicks. They come only from confirmed acquisition data.

---

## Acquisition and spend

A separate, business-grade view of what campaigns actually deliver.

- **Visits, registrations and qualified acquisitions**, all confirmed by your own back office rather than guessed from clicks.
- **Acquisition by market and landing page**, with filters for date, website and device.
- **Daily spend reconciliation:** enter campaign spend per day and see which days are reconciled.
- **Cost per acquisition** is calculated only when the figures support it. It is shown as unavailable when a spend day is missing, an attribution window is still open, coverage is unknown or there are no customers yet.
- **No duplicate counting:** a retried or repeated report of the same registration counts once.
- **Attribution windows:** each visit has a fixed window (seven days by default) in which a result can be credited to it.
- **Secure connection keys:** each website gets its own back-office key. The key is shown once, stored scrambled, can be revoked at any time and only works for its own site.
- **Consent withdrawal:** when a visitor withdraws consent, all of their linked acquisition and heatmap evidence on that site is deleted, even while collection is paused.

---

## Experiments: A/A and A/B testing

Infrared includes a complete, disciplined testing lab.

### Running a test
1. **Start with an A/A test** (two identical versions) to prove that measurement works.
2. **Create an A/B test** with a control and a candidate version.
3. **Plan before you start:** main outcome, expected baseline, smallest meaningful improvement, minimum number of active days and attribution window.
4. Infrared calculates the **sample size needed** for each version.
5. **Start, pause, resume or close** the test. A closed test cannot be reopened.
6. **Freeze final readout:** once every check passes, the result is locked permanently. It survives even after raw data expires.

### Fair assignment
- Visitors are split 50/50, and each visitor keeps the same version for the whole test.
- Infrared confirms which version was **actually shown**, not just which version was assigned.
- Page settings are locked while a test is running, so nobody can change the rules halfway through.

### Honest statistics
- 95% confidence ranges on the difference between versions.
- Relative improvement, shown only when it makes sense.
- **Allocation check:** warns if the 50/50 split looks wrong, a common sign of a broken test.
- **No winner is declared** while the test is running or paused, is too small, has open attribution windows, is missing confirmations of what was shown, or lost data to privacy deletions.
- An A/A pass is a health check, not a winner.
- Market and device breakdowns are labelled **exploratory**.

### Experiment extras
- **Experiment portfolio** listing every test, its status, assigned and measured visitors, and its main metric.
- **Experiment heatmaps** that use only the visitors assigned to each version, each drawn on that version's own screenshot.
- **Experience guardrails** for each version, such as speed, errors and frustration signals, to review before rollout.
- **Local experiment lab** to preview the full flow safely, including consent, version assignment, clicks, a demo registration and consent withdrawal.
- **Sample outcomes** can be generated for training. They are always marked as **SAMPLE DATA** and never mixed with real results.

---

## Experience diagnostics

Infrared can also show how a page *feels* to the visitor. Diagnostics are turned on separately for each page and run only after consent.

| Signal | What it means |
| --- | --- |
| **Load time** | How quickly the page finished loading |
| **First content shown** | When the visitor first saw something on screen |
| **Main content shown** | When the biggest piece of content appeared |
| **Interaction delay** | How long the page took to react to a click |
| **Layout shift** | How much the page jumped around after consent |
| **Error signals** | Generic counts of page errors. No error text or page content is ever read |
| **Repeated clicks** | Three or more fast clicks in the same spot within one second |
| **No-response clicks** | A button or link click with no visible reaction within one second |

- Speed figures are shown as typical (p50), slower (p75) and slowest (p95) visitors, with the number of measurements behind each.
- Daily trend charts let you pick which signal to show.
- **"Worth a closer look"** flags pages with low button visibility, three or more repeated-click clusters, or three or more no-response clicks. Each flag shows the counts behind it. These are suggestions to check, never automatic verdicts.

---

## Charts, tables and exports

### Interactive charts
- Line, bar and area views on Overview, Funnels, Diagnostics, Heatmaps, Comparisons, Page versions and Operations.
- **Click a legend item** to hide or show a series.
- **Hover or use the keyboard** to read exact values.
- **Zoom handles** for date ranges longer than 14 days.
- **Every chart has a data table** that you can expand to see the numbers behind it.
- Missing data is shown as a gap, never as a fake zero.
- Dark, readable text with distinct chart colours.

### Data tables
- Used for landing pages, campaigns, elements, registry, acquisition, experiments, audit trail and maintenance history.
- Sort by any column, search, and show 5, 10, 25 or 50 rows per page.
- First, previous, next and last page buttons, with clear empty, loading and error states.
- History tables hold a snapshot, so new records do not shift the page you are reading.

### Exports
- **Annotated heatmap PNG** for presentations and reports.
- **Aggregate CSV** for spreadsheets.
- **Registry export** for review and reuse.
- Every export is recorded in the audit trail.

---

## Privacy

Privacy is built into how Infrared works.

### Three locks before anything is recorded
1. **The visitor agreed** to analytics.
2. **The page is exactly one of yours** and is a public, anonymous page.
3. **The page is approved and enabled** in your workspace.

If any one of these is missing or unclear, **nothing is recorded**.

### What Infrared never collects
- No tracking cookies.
- No names, emails, phone numbers or account details.
- Nothing typed into forms or text fields.
- No page text and no full page addresses.
- No visitor IP addresses or browser fingerprints.
- No session recordings and no keystroke logging.
- No following visitors across websites.

### What Infrared respects
- **Consent withdrawal:** tracking stops immediately and unsent data is discarded.
- **Do Not Track and Global Privacy Control:** collection is switched off for browsers that send these signals.
- **Private areas:** any marked area is excluded from clicks, visibility and screenshots.
- **Sensitive moments:** when a sensitive screen opens on the same page, tracking pauses.
- **Leaving the page:** moving to another page stops tracking straight away.

### Your controls
- Retention periods for raw data and screenshots.
- A minimum audience size, so small groups are never shown and individuals cannot be singled out.
- Per-page on/off switches and a global emergency stop.
- An automatic daily clean-up of expired data.

---

## Security

- **Private workspace:** sign-in required, strong password protection, sessions that expire when idle and after a fixed time, and limits on repeated sign-in attempts.
- **No default password:** each workspace gets its own unique administrator access.
- **Protection against forged requests:** every change must come from the real dashboard, with a valid security token.
- **Strict data checks:** any event with unknown or unexpected information is rejected.
- **Exact-site acceptance:** each website can only send data for itself.
- **Abuse limits:** caps on message size, events per visit, events per day and requests per source.
- **No double counting:** repeated or replayed events are recognised and ignored. Conflicting copies are rejected.
- **Safe screenshots:** only genuine image files are accepted. Images are cleaned, re-encoded and fingerprinted, and only authorised people can view them.
- **Safe link checks:** checks run only on public, secure web addresses and never reach internal networks. They are rate-limited and never send logins.
- **Protection against malicious content:** labels and names are always shown as plain text, so injected code cannot run.
- **Hidden files stay hidden:** requests for private or hidden paths are refused.
- **Secrets are never shown twice:** connection keys are displayed once and stored scrambled.
- **Role-based access:** people see only the websites they are members of, and only the actions their role allows.
- **Full audit trail** of changes, reviews and exports.
- **Security review completed:** a dedicated review found issues, fixed each one and added tests so they cannot return. Dependency checks reported zero known vulnerabilities at the last checkpoint.

---

## Speed and lightness

- **Tiny tracking code:** about 6 KB compressed, much smaller than typical analytics tags, so landing pages stay fast.
- **Loads only when allowed:** nothing loads before consent and an exact page match.
- **Light on the visitor's device:** diagnostics are capped at 40 signals per visit, and only a few checks run at once.
- **Near-live reporting:** events are sent about every five seconds, processed within about a second and shown on the heatmap within a few seconds.
- **Charts load only when needed**, so the dashboard opens quickly.
- **Reliable delivery:** events are sent in batches with a limited number of retries. Every event is safely stored before it is acknowledged.
- **Self-healing processing:** interrupted work is picked up again automatically, and failed work is retried with increasing pauses.
- **Clear limits:** large reports have size budgets and say so clearly when a budget is exceeded, instead of slowing down silently.

---

## Data you can trust

Infrared is designed never to make the numbers look better than they are.

- **Three separate data sources:**
  - **Recorded activity:** real collected activity. This is the default.
  - **Generated samples:** demo and training data, clearly labelled.
  - **Earlier data (unclassified):** older mixed data, kept separate.
  - They are never mixed. Samples never inflate real results.
- **Views, not people:** Infrared counts tracked page views and never claims they are unique people.
- **Sampling is shown:** every report shows its sample rate.
- **Recent data is marked provisional** for 48 hours.
- **Missing means missing:** gaps stay gaps and are never filled with fake zeros or guesses.
- **Small groups are hidden:** below the privacy threshold, numbers are suppressed and left out of totals.
- **Clear definitions:** "seen" means at least half on screen for at least one second. "Engaged" and "quick exit" are defined precisely.
- **Honest limits:** scroll reach is not proof of reading, and repeated clicks are a hint rather than proof of frustration. Infrared states these limits on screen.
- **Consistent time:** reports use UTC day boundaries and show times in the workspace's local time zone (Bucharest).
- **Late arrivals are counted and shown**, together with delivery and retry figures.

---

## Testing and verification

Infrared is tested continuously and thoroughly.

- **More than 120 automated checks** cover the rules behind every report, including funnels, experiments, privacy, security and recovery.
- **23 complete browser journeys** run like a real user would:
  - consent, clicking a button and seeing the click appear on the heatmap;
  - declining and withdrawing consent, and confirming that tracking stops;
  - creating experiments, assigning versions and confirming what was shown;
  - charts, tables, zoom, keyboard use and mobile layouts;
  - attempts to inject malicious content, which must be blocked.
- **Link checks** confirm that the dashboard, demo pages and collection points work and that the tracking code has not been altered.
- **Backup round-trip test:** a backup is created, restored into an empty workspace and verified.
- **Your data is never touched by tests:** every test run uses its own temporary workspace and is cleaned up afterwards.
- **Safe test pages:** fictional Halloween and Christmas casino pages, and a consented experiment lab, let you try everything without touching a real website.

---

## Maintenance, backup and recovery

- **Automatic daily clean-up** (after 02:00 UTC) removes data older than your retention rules.
- **Verified backups** can be run on demand or on a schedule (after 03:00 UTC, kept for seven days by default). Each backup is read back and checked before it is reported as successful.
- **Backups never overwrite** an existing backup.
- **Safe restore:** a backup can only be restored into a fresh, empty workspace, and its fingerprints are checked first.
- **Alerts** for failed work, processing delays, unusual rejection levels and failed or overdue backups.
- **Automatic recovery** of interrupted operations after 30 minutes.
- **Optional monitoring connection** to send service health figures to your company's monitoring platform. No visitor data is included.

---

## Team roles and access

| Role | Can do |
| --- | --- |
| **Owner** | Everything, including Operations, maintenance, backups and the emergency stop |
| **Administrator** | Manage their websites, pages, policies, references and reviews |
| **Analyst** | Explore reports, heatmaps, funnels and experiments, and run link checks |
| **Installer** | Get installation material and run link checks, without access to screenshots |
| **Viewer** | Read reports and check results |

Every person sees only the websites they are a member of.

---

## What Infrared deliberately does not do

- No session replay or video recording of visitors.
- No tracking cookies and no lasting visitor profiles.
- No following people across websites.
- No reading of forms, passwords, page text or keystrokes.
- No financial tracking, and no guessing of deposits or registrations from clicks.
- No automatic "winner" claims, no invented uplift and no automated rollouts.
- No reliance on outside analytics products. Infrared is built entirely in-house.
- No whole-site tracking. Only the exact pages you choose.

---

## Current release status

This release is a **complete local demonstration workspace**. Every feature above works today on the built-in test pages, using real clicks from your own browser.

**Collection on live company websites is deliberately switched off** until the production setup is approved. That setup includes a secure public collection address, company sign-in, consent platform connection and final approvals. Pages already added for the UK and Romania markets are saved as **disabled drafts**. They are ready to go live once those steps are complete.

---

*Infrared by Graphoria: private, precise and honest analytics for the landing pages that matter.*
