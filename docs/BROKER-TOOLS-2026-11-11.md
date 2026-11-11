# Broker workspace and resources

The account portal now opens with My listings and a Resources navigation button. Public catalog/collection links are in Resources, alongside copyable WhatsApp text, a locally generated downloadable collection QR SVG, publishing/photo/preparation guides, support, and instructions for printable sheets.

Listing rows show an 80 × 64 cover thumbnail, retain clickable titles and existing actions, hide the internal-ID fallback, and offer a printable sheet for published listings. Status choices include counts scoped to the current search. Drafts of published listings can belong to both the Drafts and Published filters, matching existing selection semantics. Missing or failed photos use a No photo placeholder.

The authenticated owner list adds short-lived signed photo URLs. It selects the current cover or first eligible photo-tour image; document categories are never candidates. Uncommitted legacy drafts require an inspected valid image before signing. Missing storage objects do not block the list. Catalog demo summaries carry their first public image. Owner records are explicitly filtered by authenticated ownership before signing.

Resources uses the existing stable collection URL and clears account-specific content on logout/session expiration. QR codes are generated locally with vendored qrcode-generator 2.0.4 (MIT), with no external QR service. Copy operations have a selectable-text fallback and generation guards against restoring content after sign-out. Account names stay literal in both languages.

`/cuenta/sheet/?id=<public-id>&collection=<slug>` loads the current public collection snapshot. Without a collection it reads the public catalog array. Missing, unpublished or foreign-collection listings fail closed. Sheets contain public cover, title, locality, price, area, description, public contact and the listing URL; demonstration disclosures remain visible. The browser Print / save PDF action waits for image decoding. Private draft data and documents are not used.

Validation: 356 tests pass; build and git diff --check pass. Focused tests cover cover selection, document exclusion, ownership, missing photos, tabs, language changes, QR download, invalid collections, clipboard fallback/races, published-only sheets, catalog response shapes and private-data exclusion. Generated QR images were independently decoded with jsQR at both normal and maximum collection slug lengths. jsQR was used only from /tmp, not added to the app.

Visual verification limitation: current CUA inventory reports “Local browser use is disabled in Work settings.” Responsive CSS and DOM behavior were checked, but no actual desktop/mobile browser rendering was inspected.

Requires both Vercel API/static deployment and GitHub Pages frontend deployment. Publication evidence will be recorded after verification.
