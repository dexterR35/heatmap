# Link, pixel and delivery checks

The registry saves selected URLs and acquisition metadata. Saving or importing a row does not put code on a landing page, prove that a pixel exists, or enable live collection. The original UK example is a disabled draft created from the URL supplied during setup.

Use **Check link & pixel** in Landing pages, Markets, or Installation. Results persist across reloads. Inspection does not change collection or consent, render JavaScript, create views, or send events.

The check reads the exact registered URL, follows up to four redirects, and inspects up to four same-origin script files without query strings. Each response is limited to 512 KiB; the entire probe has a 12-second deadline. External scripts, tag managers, consent-dependent loaders and browser execution can remain unverified. A redirected campaign or login page is not reported as a successful landing-page match.

| Signal | Meaning |
| --- | --- |
| Success · page loads | The exact page returned a successful HTML response to this server. This does not establish browser rendering speed or availability in every country. |
| Blocked · cannot inspect | The server returned 401, 403 or 429. Pixel presence remains unverified. |
| Pixel code detected | A static SDK/bridge marker was found. Matching site-key and collector settings are separate checks; this does not prove execution or consent handling. |
| Pixel not found in HTML | No marker was found within the inspected source. A dynamic or consent-gated installation can still exist. |
| Receiving events | This page has server-received Recorded events during the preceding 24 hours and collection is enabled. Sample and legacy views are excluded. This is an activity window, not a permanent installation certificate. |
| Draft · collection disabled | The saved page is not enabled for collection. This label takes precedence even if old events remain. |

Response-header and document timings include DNS/connection work for that request, measured from the checking server. They exclude full browser rendering, images, third-party tags and user interactions. Redirected pages show timings for the final response. This is not a UK-versus-Romania geographic performance test. Bot protection can return different results for different clients or requests.

Pending and failed processing counts use Recorded views for that exact site and page. A clear queue proves no current backlog; it cannot establish live delivery latency on a page with no installed tracker. The SDK normally flushes every five seconds (some actions flush sooner); the native worker checks every second and the heatmap screen polls every three seconds. These intervals are not a delivery SLA. Real-user delivery is also affected by consent, network access, sampling and blocking.

All report **date boundaries remain UTC**. The Markets table exposes the configured website timezone; that metadata does not change report filtering. Existing general dashboard times display in Europe/Bucharest; diagnostic receipt/check timestamps explicitly use UTC. UK reporting metadata is Europe/London; the original Romania draft currently has UTC metadata and can be edited in Markets. Compare market-local calendar days only after choosing the intended time bounds. DST offsets must be derived from IANA timezones, not fixed UTC offsets.

Authenticated members may read only their own sites. Owners, administrators, analysts and installers may request a check on an accessible registered page; viewers may only read results. Existing Origin and CSRF checks apply. Network checks are limited to 30 per user per ten minutes, at most three concurrently and one per page at a time. Targets must be public HTTPS on port 443, except the configured synthetic loopback demo. Every redirect and inspected script connection revalidates and pins DNS addresses; private, loopback, link-local and transition targets are rejected. The checker sends no cookies or credentials and stores no response bodies. Latest results are included in verified backups.
