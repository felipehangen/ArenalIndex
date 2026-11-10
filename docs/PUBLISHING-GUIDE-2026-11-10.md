# Public listing guide and recorded rule acceptance

The public, bilingual guide is `/publicar/` (`?lang=en` or `?lang=es` selects a language). It explains the existing requirements before an account is requested: authority to list, the precise entrance, a legible cadastral plan and land area, honest facts and price, photo coverage and rights, and editorial review. It includes original SVG illustrations, a photo checklist, preparation progress, printable content, a share link, FAQs, and the configured WhatsApp/email contact. The publishing contact panel and account login page link to it.

Commercial conditions such as fees or exclusivity remain outside the standard acceptance, as requested. Account activation remains an administrator action. The public preparation checklist saves only checkbox IDs in the visitor's browser; it never records consent or submits a listing.

## Acceptance before account workspace access

Google or password authentication establishes the person's account identity. Before opening any listing or following an editor deep link, `/cuenta/` shows the current standard rules and an unchecked acceptance box. The person may accept and continue or sign out. Authentication alone grants no listing access until the current rules have been accepted. Existing accounts and existing sessions without acceptance are also gated; no acceptance is backfilled.

The shared source is `site/publicar/rules.mjs`, initially version `2026-11-10.1`. `server/portal/listing-rules.mjs` hashes the complete bilingual rules and consent text. Authenticated `accept_listing_rules` requires explicit `accepted: true`, the current version and hash, and an allowed language. Server time and the verified account identity determine the receipt; supplied identity/date fields are ignored.

The private account record stores `rulesAcceptances[contentHash]` with version, hash, full bilingual rule snapshot, language, server timestamp, account subject/email, and authentication method. An atomic account update guards activation, session/password revisions and acceptance revision. Retries preserve the original receipt; old receipts remain intact. Admin's account list shows accepted/pending status and the current receipt's version, date/time (Costa Rica), and language. Receipts are never added to public listings. No IP address or browser fingerprint is collected for this feature.

Owner API listing and workspace actions reject missing current acceptance with `403` and `listing_rules_required`. Session inspection, logout, password replacement and acceptance remain available. Existing listing-specific permission checks remain necessary and separate. Accepting these rules does not publish a property or bypass publication review.

When changing the rules, bump the version, update both languages and the public static rule cards, and retain previous private receipts. Tests verify the static public cards match the canonical Spanish clauses. The account acceptance screen uses the rules returned by the API, avoiding consent to stale client copy.

## Validation and rollout

- 263 tests passed, including server enforcement, identity binding, concurrent/retried acceptance, persistence failure, suspension races, both login methods, UI errors/logout races, direct editor redirects, translations, preparation persistence, and share fallback.
- `npm run build` and `git diff --check` passed. The local guide returned HTTP 200.
- Actual browser visual/interaction QA is unavailable: the computer-use tool reported that local browser use is disabled in Work settings. DOM tests do not replace that verification.
- Publish the GitHub Pages frontend first, then deploy the API using the existing Vercel project. `vercel.json` explicitly includes the shared rules module in both account and admin function bundles. No data migration, account creation, listing mutation, or automatic acceptance is part of deployment.
