# Account and catalog workflow

New submissions start in `/cuenta/` (`/account/` is an alias). Bare `/newlisting/` sends visitors to account sign-in. Production intake rejects anonymous creation; existing private review links continue to work.

Drafts can be saved with missing fields. Submitting requires the form checklist, approval requires document/photo checks, and publishing requires reviewed public copy and confirmation. Reopening returns a record to draft and clears the approval; the last published snapshot stays visible until replaced or unlisted. Corrections can be discussed outside the application. Legacy `changes_requested` records display as drafts and remain editable.

`listing_title_es` and `listing_title_en` are explicit optional inputs. Normalization maintains the previous language/title/translation keys for publication compatibility and migrates older drafts. A missing translation falls back to the supplied title.

Clicking a real listing opens its editor. The editor toolbar groups save, preview and the applicable review/publication step; secondary actions live in More actions. Admin listing actions are also grouped in each row. Approval/publication opens the existing review in a same-origin dialog and uses the same protected endpoints and validation. Deletion requires typing DELETE or BORRAR (checked by the UI and server) and is guarded by version, edit revision, and publication revision. A deleted record becomes an inaccessible tombstone with empty payload and no publication; existing private media objects are not physically purged by this listing-management action.

## Demo listings

Supabase remains the read-only public source for seeded demo data. The admin API lists its demo records alongside intake submissions. Demo edits, unlisting, and deletion are saved as private decisions in `catalog/decisions.json` in the existing Vercel Blob store, with ETag and per-record revision checks. These decisions do not modify the Supabase seed rows. Deletion is permanent in the application; a seed refresh cannot silently restore it.

`server/catalog/supplemental.mjs` adds the stock-photo showcase `lot-101`. Both production public and admin APIs pass it to the same catalog, so edits, unlisting and deletion apply identically and survive deployments. It never acts as an offline fallback. A Supabase row with the same ID takes precedence without duplicating the listing or bypassing its decisions. Photo sources and license details are in `docs/demo-photo-credits.md`. Deploy the frontend photo assets before deploying a new supplemental demo to the API.

The website uses `/api/listings?catalog=1` as its combined catalog so every visitor receives the same managed result. The original `/api/listings` response remains compatible for intake consumers. The combined endpoint loads the sources in parallel and fails if a source or decision store is unavailable, rather than resurfacing deleted demos. Never re-enable direct browser merging of raw Supabase rows while managed decisions exist. No database write key is shipped to the browser.
