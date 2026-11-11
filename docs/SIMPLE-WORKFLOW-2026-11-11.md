# Simplified listing review and editing

The seller flow is fill in / preview / submit, then edit / submit changes for later updates. Account authorization and recorded rule acceptance are unchanged.

The admin review screen now includes the document/photo checks and public editorial fields together. **Approve and publish** (or **Approve and publish changes**) performs one atomic approval/publication update. A private buyer preview accepts the current review inputs without persisting approval or changing the live listing. **Continue later → Save approval for later** remains an optional action that saves the review without publishing. The public title and introduction being typed remain in the current screen when using that secondary action; they are persisted with publication.

`approve_publish` is protected by the existing admin session or private review token. It validates the review, public copy, confirmation, content version, edit revision and publication revision. Photo preparation and publication index discovery precede one guarded record update. Failure or a concurrent reopen leaves the prior public snapshot intact. The existing separate approval/publication endpoints remain compatible.

Listing Edit links carry a one-use `edit=1` intent. The editor consumes it and reopens submitted/approved records with the existing revision-checked endpoint. Drafts need no reopening. Local dirty changes are preserved. Refreshing after submission does not repeat the original edit intent. The seller's in-editor Edit control also reopens directly, with a notice instead of a confirmation dialog. The admin editor no longer requires a separate Reopen action; Return for changes remains available in the review screen for sending work back to the account holder.

All public snapshots, private documents, account ownership and unchanged-listing relisting rules remain governed by the existing server checks. No production listing, account or acceptance receipt was changed as part of implementation or tests.

Validation: all 347 tests passed in the final full suite, including the one-use Edit/refresh regression. Build and `git diff --check` passed. Tests cover atomic publication, private previews, authorization, failed media preparation, stale revisions, concurrent reopening, unsaved-change preservation and UI confirmation/reset behavior. Browser inventory reported local browser use disabled in Work settings, so no authenticated browser visual verification was performed.

Deploy the API before the frontend. All changed frontend module entry chains and the English dictionary use updated cache versions.


## Production deployment

Felipe explicitly approved deployment on November 11, 2026. Application commit `c9b482d0c90b67e96650f8fe52fd389844eb937e` is published:

- Vercel deployment `dpl_HZXqZjP9XNn8oVvESr73Z3dNTAz7` reached READY. Inspection confirmed both `go.arenalindex.com` and the application's `arenalindex-intake.vercel.app` API hostname point to it.
- GitHub Pages run [43050233711](https://github.com/felipehangen/ArenalIndex/actions/runs/43050233711) succeeded after the API deployment.
- All 15 live HTML/module/dictionary URLs reached through the five account/editor/review entry pages matched the tested local source byte for byte, including the actual cache-version references.
- The public catalog response was identical before and after deployment (31 entries at the check). Anonymous `approve_publish` requests to the admin API returned HTTP 401.
- No live listing or account was edited or published as a test. These checks establish deployment and asset availability; authenticated browser interaction remains unverified.
