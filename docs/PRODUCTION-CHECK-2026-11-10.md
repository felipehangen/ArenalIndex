# Production review — November 10, 2026

**Later update, 11:49 Costa Rica:** the `www` DNS/certificate problem below is now resolved and independently verified. The supplied Chrome QA found additional interface issues, including uncounted overlapping map pins. Read [QA-REVIEW-2026-11-10.md](QA-REVIEW-2026-11-10.md) for the current findings; the original review below remains a dated record.

## Outcome

The apex site, catalog, media, currency filters and tested access boundaries passed. **Do not treat this as an unconditional launch sign-off:** HTTPS for `www.arenalindex.com` currently fails certificate validation. Interactive browser and real sign-in/email delivery checks were not completed in this review.

The live read-only check ran at **17:07–17:08 UTC / 11:07–11:08 Costa Rica**. It did not create, edit, publish, unlist or delete listings, send messages, or change accounts.

## Correction included in this review

The property gallery and image alternative text still called all demo photos AI-generated. The current curated demos use licensed stock photography. The detail gallery now says **“imágenes ilustrativas” / “illustrative images”**, retaining the demo disclosure and photographer credits. Hero, tour and enlarged-image alt text use the same neutral wording. Updated asset versions refresh the homepage and buyer preview.

Validation after this wording change: **238 tests passed**, build passed, `git diff --check` passed, and the composed gallery note translated to `4 sample photos · illustrative images`.

Only frontend files changed. The API does not require redeployment for this correction.

## Confirmed domain issue and exact repair

- `https://arenalindex.com/`: valid HTTPS, HTTP redirects to HTTPS.
- `https://www.arenalindex.com/`: `ERR_TLS_CERT_ALTNAME_INVALID`.
- GitHub Pages reports an approved certificate for **arenalindex.com only**, with HTTPS enforced.
- Authoritative DNS uses GoDaddy nameservers `ns21.domaincontrol.com` and `ns22.domaincontrol.com`.
- The existing `www` CNAME points to `arenalindex.com`.

In GoDaddy, edit only this existing record:

| Type | Host | Current target | Required target |
| --- | --- | --- | --- |
| CNAME | www | arenalindex.com | felipehangen.github.io |

Keep its TTL and all other records unchanged. Keep the GitHub Pages custom domain set to `arenalindex.com`. After DNS propagation and GitHub certificate provisioning, verify that `https://www.arenalindex.com/` redirects to the apex without a certificate warning. A saved DNS record alone does not confirm a working certificate. Do not remove the working apex configuration as an initial repair.

This follows [GitHub's apex/www configuration instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain-and-the-www-subdomain-variant). GitHub explicitly warns that pointing a subdomain to the apex can break HTTPS. No available GoDaddy connector was found; the browser tool continued to report disabled after the user enabled it. The user was given an exact prompt for their Chrome extension to make this repair. Completion is still to be verified.

## Passed checks

- **32 public listings:** 31 curated demos, one real listing; unique IDs; no retired generic demos.
- USD and CRC total-price and per-land-m² filtering passed against every normalized live listing.
- Published BCCR rate effective **2026-11-10**: buy **445.62**, sell **451.02**; the site uses their average.
- All **85 local demo photo assets** downloaded successfully and matched local SHA-256 hashes, totaling 21,564,276 bytes.
- All **7 real-listing public photos** downloaded through the published image endpoint. Temporary signed URLs were not copied into the report.
- Every demo has the authorized Felipe contact. The real listing was unchanged.
- The public payload check found no private record fields, tokens, documents or internal review fields.
- Homepage, admin, account aliases, editor, review and buyer-preview pages returned 200; the checked private pages carry `noindex`.
- All **36 checked same-origin page scripts/styles** were available and matched the built assets, excluding the intentionally regenerated exchange-rate snapshot.
- Public admin/account login configuration is present; unauthenticated private listing and record reads return **401** with no-store where checked.
- Admin/account reject foreign origins with **403**; allowed-origin preflights return **204**.
- Anonymous intake submission is blocked with **401**; private review without a token returns **401**.
- Unknown public photos return **404**; writes to the public catalog return **405**.
- Intake storage/configuration health reports ready. This is not an email-delivery test.
- MapLibre JavaScript/CSS, Lucide icons, Google Fonts CSS and a representative OpenStreetMap tile returned **200**.
- Dependency audit: **zero known production vulnerabilities** at the time checked. This is not a comprehensive security audit.

The full local suite covers Google token validation, account/password authorization, draft/review/publication transitions, concurrent updates, deletion confirmation, media projection, bilingual content, currency calculations and simulated interface behavior.

## Verification limits and later improvements

- Interactive desktop/iPhone layout, scroll and map checks remain unverified in this review because browser access failed even after the authorized retry. DOM tests and successful asset requests do not substitute for that check.
- No real Google account sign-in, new account provisioning or email-delivery test was performed. Google OAuth audience/testing availability for additional accounts and the Resend sender configuration should be checked before inviting additional users. No email was sent during the review.
- No sitemap or robots.txt was present; listing routes use URL hashes and share homepage metadata. Improving individual-listing search indexing and social previews is separate work, not a broken browsing function.
- Current demos remain explicitly fictional and use illustrative stock galleries. They were intentionally retained.

Private machine-local evidence is in ignored `.vercel/production-check-2026-11-10/` (live check script, result JSON and catalog snapshot). Do not commit private operational snapshots or signed media URLs.
