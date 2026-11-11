# Simplified listing review and editing

The seller flow is fill in / preview / submit, then edit / submit changes for later updates. Account authorization and recorded rule acceptance are unchanged.

The admin review screen now includes the document/photo checks and public editorial fields together. **Approve and publish** (or **Approve and publish changes**) performs one atomic approval/publication update. A private buyer preview accepts the current review inputs without persisting approval or changing the live listing. **Continue later → Save approval for later** remains an optional action that saves the review without publishing. The public title and introduction being typed remain in the current screen when using that secondary action; they are persisted with publication.

`approve_publish` is protected by the existing admin session or private review token. It validates the review, public copy, confirmation, content version, edit revision and publication revision. Photo preparation and publication index discovery precede one guarded record update. Failure or a concurrent reopen leaves the prior public snapshot intact. The existing separate approval/publication endpoints remain compatible.

Listing Edit links carry a one-use `edit=1` intent. The editor consumes it and reopens submitted/approved records with the existing revision-checked endpoint. Drafts need no reopening. Local dirty changes are preserved. Refreshing after submission does not repeat the original edit intent. The seller's in-editor Edit control also reopens directly, with a notice instead of a confirmation dialog. The admin editor no longer requires a separate Reopen action; Return for changes remains available in the review screen for sending work back to the account holder.

All public snapshots, private documents, account ownership and unchanged-listing relisting rules remain governed by the existing server checks. No production listing, account or acceptance receipt was changed as part of implementation or tests.

Validation: 346 tests passed in the full suite, then both actual editor tests passed after adding the one-use Edit/refresh regression. Build and `git diff --check` passed. Tests cover atomic publication, private previews, authorization, failed media preparation, stale revisions, concurrent reopening, unsaved-change preservation and UI confirmation/reset behavior. Browser inventory reported local browser use disabled in Work settings, so no authenticated browser visual verification was performed.

Deploy the API before the frontend. All changed frontend module entry chains and the English dictionary use updated cache versions.
