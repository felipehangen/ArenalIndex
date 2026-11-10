# Account property collections

Public account pages use `https://go.arenalindex.com/collection/account-name/`. Felipe selected this domain and clean path; no query string is needed. Vercel rewrites these paths to the same ArenalIndex explorer. GitHub Pages continues serving the main domain.

The explorer retains its header, cards, filters, map, sorting, details and bilingual controls. A pale green identity strip above the filters/listings shows “Properties from” and the account's display name, an initials tile, and a link to the full catalog. Details retain account attribution. Sharing and listing inquiries include the collection URL and property fragment. Contact destinations remain the reviewed public contact on each listing; private login emails are never used. Publishing and sign-in links lead back to the main domain.

## Access and identity

- Admin → Cuentas y acceso shows **Ver página pública** for active named accounts.
- The signed-in account portal also shows **Ver página pública**.
- `public_slug` is assigned once from the initial account name. Renaming the account preserves its URL. Accents, case and punctuation are normalized for the URL only.
- Private `portal/account-slugs/<sha256>.json` reservations prevent conflicting assignments. When different names normalize to the same slug, a stable account-derived suffix distinguishes them. Reservations are retained; a renamed account's old URL never transfers to another account.
- Existing named accounts receive their slug when admin loads the accounts list, on their next sign-in/session refresh, or before an admin renames them. New named accounts receive it on creation. No bulk rename or reassignment of listings is needed.
- Inactive or unnamed accounts have no public page. Active accounts without published properties have a named empty page.

## Data boundary

`GET /api/listings?account=<slug>` returns `{account, listings}`. The API resolves immutable account ownership and paginates the account's private record index, returning only current `publication.listing` snapshots. Newer unpublished drafts do not replace the last published snapshot. Deleted, unlisted, foreign-account and never-published records are excluded. Demos from the general catalog are not mixed into collections. An invalid account or source failure never falls back to the full catalog.

The response contains only the public display name, slug, derived public key, URL and existing public listing projections. Passwords, email identities, internal subjects, private records and documents are excluded. Responses use `no-store`.

Favorites retain other accounts' IDs when a collection changes its own saved properties. The collection's displayed Saved count and list include only its own available listings. Browser storage on `go.arenalindex.com` is separate from storage on the main domain.

## Verification

327 tests passed; `npm run build` and `git diff --check` passed. New tests cover account isolation/pagination, private-data exclusion, empty/invalid/disabled accounts, clean URL loading, root-relative assets, stable URLs after rename, slug collisions, scoped sharing, and cross-account favorite preservation.

Browser inventory still reports “Local browser use is disabled in Work settings.” Automated DOM and HTTP checks are not visual desktop/iPhone verification.

Deployment evidence will be recorded after publication. This task does not publish listings, change their ownership or assign contacts.
