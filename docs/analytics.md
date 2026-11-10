# Admin analytics

Administration → **Estadísticas / Analytics** shows public-site activity for the last 7, 30, or 90 days, or a custom range within the last 90 days. Dates use Costa Rica time. Google admin authentication and the existing allowlist protect every report; the public collector cannot read reports.

Included:

- Visits, estimated unique browsers, active time, page clicks, property opens, gallery opens, photo enlargements and card photo changes.
- Save/remove actions, latest observed saved listings, and distinct saved properties.
- Contact clicks, share-dialog opens, filter applications and searches returning no results.
- Rankings for properties, locations and individual photos; referral domains and device categories.
- Expandable anonymous visit timelines, with 25 visits per page and the last 100 events per visit.
- Daily traffic and real-property inventory graphs, accessible data tables and explicit empty states.

## Meaning and limits

A visit is a tab session that renews after 30 minutes without interaction. Browser IDs expire after 90 days and are estimates, not people. A visitor using multiple browsers can count multiple times. Active time is sampled while the page is visible and stops after 60 seconds without interaction. It is not a measure of continuous attention. Clicks include ordinary clicks/taps on the public page; contact clicks do not prove a message was sent or a sale occurred.

Favorites remain in local storage. “Observed saved listings” sums each reporting browser's latest snapshot **within the selected period**. It includes pre-existing favorites once that browser visits again. It cannot reconstruct all favorites in browsers that never report. The same property saved in two browsers counts twice; “distinct listings saved” deduplicates properties.

Real/demo filters apply to property interactions, observed saves, and rankings. Visit, browser, active-time and general-click totals cover the public explorer and publishing guide. Location rankings count property opens in that locality, not physical visits. Automatically loading images is not a photo open. Enlarging a photo or moving to another enlarged photo counts; changing the card carousel is reported separately.

The real-property graph counts the authoritative combined public catalog, excluding demos, unpublished drafts and withdrawn properties. Only complete successful catalog reads can produce a snapshot. Vercel's `waitUntil` saves a snapshot in the background, at most once per minute per warm function instance. Loading a report also records the current inventory. Each day retains its latest observed count, so it is a sampled daily history, not an audit of every publication. Days without an observation remain gaps. Earlier inventory or traffic is not fabricated from creation dates. Current-day data is incomplete until that day ends.

## Storage and privacy

`POST /api/analytics` accepts bounded, whitelisted public activity. It requires an allowed site Origin, hashes visitor/session identifiers on the server, limits collection requests by salted IP hash, and stores no raw IPs, user-agent strings, names, emails, form values, query strings or private URLs. Referrers are reduced to hostnames. Photo references are restricted to the site's photo paths and canonical public listing photo endpoints.

The client runs only on `/` and `/publicar/` on the two production domains. It excludes private routes, previews, local development, known automation, and tabs with an active admin session. It respects Do Not Track and Global Privacy Control. Blockers, network failures, unload behavior, storage restrictions and spoofed client activity mean these are indicative analytics, not billing-grade counts.

The existing private Blob store holds:

- `analytics/batches/YYYY-MM-DD/<batch-id>.json`: immutable activity batches, with a 90-day TTL. Retries reuse an ID and cannot double-count a batch. Collection is batched about once per active minute and when leaving the page.
- `analytics/start.json`: the first accepted collection time.
- `analytics/inventory/YYYY-MM-DD.json`: daily catalog counts and public property/photo labels. Retained without visitor data. Conditional writes prevent older observations overwriting newer ones, and preserve public labels for properties withdrawn earlier that day.

The report reads bounded date partitions and fails explicitly if they exceed 10,000 batches overall or 5,000 in one day. It never presents a silently truncated traffic total. At higher traffic volume, move aggregation to a database or analytics service rather than raising these limits indefinitely. The existing Blob rate limiter and activity writes incur storage operations; no new external analytics account is required.

## Deployment and verification

No Supabase migration or new secret is needed. The collector reuses `BLOB_READ_WRITE_TOKEN` (or `BLOB_STORE_ID`) and `INTAKE_REVIEW_SECRET`. The official `@vercel/functions` package supports background inventory writes. Deploy the API before publishing the frontend, so the collector and authenticated `analytics` action exist when the new client loads. **No historical visits or inventory were backfilled.**

Run `npm test` and `npm run build`. New tests exercise collection validation, CORS, hashing, retention, retries, concurrency, date boundaries, real/demo separation, observed saved state, protected report access, expiry cleanup, active time, language and controls, safe rendering, and graphs with missing dates. The existing application suite covers the shared admin and gallery integrations.

`node scripts/preview-analytics.mjs` serves a clearly labeled, development-only sample dashboard at `http://127.0.0.1:8768/admin/`. Fixtures live in `tests/` and the preview server is outside the deployed `site/` directory. It neither reads private records nor submits sample events to production. Browser visual QA was unavailable in this session because local browser use was disabled in Work settings; DOM tests and preview HTTP checks are not a substitute for a desktop/mobile visual review.
