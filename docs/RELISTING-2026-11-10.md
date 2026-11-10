# Relisting unchanged account listings

Owners can use **Volver a enlistar** after withdrawing their own listing. The server retains the previous publication privately when an owner unlists, and restores only that exact snapshot, including its public ID and media. No editorial content is accepted in the relist request.

Eligibility requires an owner-withdrawn snapshot, matching ownership, no active publication, matching draft/publication version, and a draft/approved/published workflow state. Saving a new draft version requires review again. Opening/reopening without saving does not change the content version. Listings withdrawn by administration, deleted listings, never-published drafts and older withdrawals with no recoverable snapshot are ineligible. Review rejection and deletion clear the retained snapshot; a fresh publication replaces it. All write paths retain revision guards; stale requests and concurrent saves cannot replace newer state.

`recordSummary.canRelist` drives the account action. Other withdrawn rows show **Requiere revisión para volver a publicar**. Confirmation explains that the previous published version is being restored unchanged. Labels are bilingual. The ordinary account session, listing-rules acceptance and ownership checks apply to `workspace_relist`.

338 tests passed and the build succeeded. Coverage includes exact snapshot/photo restoration over repeated cycles, anonymous and cross-account denial, edits before/after withdrawal, admin withdrawal, deletion, stale and racing writes, and the account button/confirmation/request guards.

For the three recently imported Asambleaterinde demos, a one-off script checks the original activation backup, exact draft/file metadata, initial version and owner withdrawal audit before attaching a recovery snapshot. It never republishes a listing, never accepts rules, and skips modified records. Private evidence is in ignored `.vercel/relisting-2026-11-10/`; the temporary environment is removed. Do not rerun the recovery script blindly.
