# ArenalIndex

Bilingual property explorer and broker workspace for La Fortuna and nearby areas.

- Website: https://arenalindex.com/
- Broker account: https://arenalindex.com/cuenta/ (`/account/` is an alias)
- Administrator: https://arenalindex.com/admin/
- Public sharing and collections: https://go.arenalindex.com/
- API: https://arenalindex-intake.vercel.app/
- Contact: equipo@arenalindex.com

## Current direction

Felipe confirmed on November 22, 2026 that **all existing listings are demos**, including the previously misclassified test listing. Felipe and one broker friend plan to add 20–30 real listings by December 31, 2026, learn from daily use, and consider additional brokers afterward. See [the pilot plan](docs/PILOT-2026-11-22.md). Historical inventory counts or claims of a real listing in dated notes are superseded by this clarification.

## Current behavior

Buyers browse the map and cards, filter and compare prices in USD/CRC, save favorites locally, and open bilingual photo tours. Demo content is disclosed. Currency conversion uses the daily BCCR indicative midpoint; it is not a quoted transaction rate.

Listing creation requires an authorized account and explicit acceptance of the listing rules. Bare `/newlisting/` leads to sign-in. Accounts can save incomplete drafts, submit for review, reopen and submit changes, and withdraw their publications. Admin reviews documents, photos and public copy before **Approve and publish**. Editing a draft does not replace its existing public snapshot. Private documents, contacts, tokens and internal notes are excluded from public projections.

Broker accounts provide listing management, public collections, short links with sharing previews, QR codes, printable sheets, and an Offers inbox. Shared offer forms collect a nonbinding first proposal, give the buyer a private receipt, and notify the broker by email. Failed email delivery does not discard an offer. There is no scheduled email retry worker. Contact-click analytics are indicative and must not be used as verified leads or billing counts.

## Architecture and caching

`site/` is the static frontend; `scripts/build.mjs` creates `dist/`. GitHub Pages hosts the main website. The existing Vercel project hosts `api/`, public sharing routes, and the same frontend. Vercel Blob holds private records and files; Supabase provides legacy demo seeds. Managed decisions override those seeds, so deleted demos cannot return through direct seed reads.

Successful public catalog, collection and sharing responses can be cached at the CDN for **30 seconds**. Prepared public JPEGs are served through the publication-authorized API path and can be cached for **five minutes**. There is no stale-while-revalidate extension. Private APIs and error responses remain `no-store`. Withdrawal stops new origin access immediately; already cached public responses can remain available for the stated window. Legacy signed photo URLs may remain usable until their existing ten-minute expiration.

## Development and release

Requires Node.js 22+ and Python 3 for local static preview.

```sh
npm ci
npm test
npm run build
npm run preview
```

The static preview is http://127.0.0.1:8766/. `node scripts/preview-listing.mjs` provides fictional interactive fixtures, including offer forms, without production submissions.

Use a feature branch and pull request. CI tests pull requests without deploying them. From the reviewed commit in a checkout linked to the existing Vercel project, run `npm run release`. This tests an isolated Git archive, refreshes the exchange rate, deploys Vercel, and verifies both production API aliases. It never uploads ignored secrets or local uncommitted changes. `--committed-only` explicitly permits a checkout with unrelated local edits while deploying only HEAD. The Vercel CLI version is pinned by the release script; an existing CLI entry file can be supplied as `VERCEL_CLI`.

Then merge/push the reviewed source to main. Pages refuses to publish until both API hosts expose the matching runtime fingerprint. Documentation-only edits and daily rate refreshes do not change that fingerprint. The scheduled rate workflow uses the same check. If deployment fails, fix/deploy the matching API release and rerun the workflow; do not bypass the check. See [operations and limitations](docs/PILOT-2026-11-22.md).

Secrets belong only in provider settings and ignored local files. Never commit production environment files, private backups or API tokens. `site/config.js` contains only public browser configuration and a publishable Supabase key.

## Further documentation

- [Account and catalog workflow](docs/catalog-management.md)
- [Photo preparation](docs/photo-preparation.md)
- [Offers](docs/OFFERS-2026-11-11.md)
- [Analytics and measurement limits](docs/analytics.md)
- [Business email configuration](docs/EMAIL-2026-11-11.md)
- [Pilot preparation and release evidence](docs/PILOT-2026-11-22.md)

Dated handoffs in `docs/` are historical evidence, not current setup instructions. The [previous README](docs/archive/README-before-pilot-2026-11-22.md) is archived for reference; its paths were relative to the repository root and its obsolete workflows must not be restored.
