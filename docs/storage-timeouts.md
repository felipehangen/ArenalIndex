# Storage timeout investigation — 2026-11-10

Production logs confirmed 60-second Vercel function timeouts on admin and public
catalog requests. A simultaneous probe returned admin configuration in 478 ms,
while challenge preparation and the catalog exceeded 55 seconds. Earlier
deployments also had catalog timeouts; the evidence does not establish analytics
as the sole cause. Direct read-only storage queries returned in 331–557 ms and
the complete demo catalog in 1.1 seconds during the investigation.

The shared Blob adapter left index listings and signed-token creation without
deadlines. Its read/write timeout used `AbortSignal.timeout`, which raises
`TimeoutError`; Blob SDK 2.9.0 only stops its retry loop on `AbortError`. The SDK
defaults to ten retries, so its backoff can outlast the function and browser.

All storage operations now have a six-second deadline spanning SDK auth
resolution, network requests, retry backoff and response-body consumption. A
regular abort cancels the request; a separate promise deadline prevents waiting
on an unresponsive SDK. Reads can retry once with a new signal. Application code
does not retry ambiguous writes. Every API invocation also supplies a shared
24-second storage budget, preventing successive calls from accumulating another
minute of waiting. Slow/failed operations log only their operation, collection,
attempt, outcome and duration. Credentials, record IDs and contents are omitted.

The admin inbox loads intake and demo sources concurrently. Both must succeed;
no stale, incomplete or resurrected catalog is returned. Conditional writes,
fresh reads, rate limits, allowlists and session revocation remain enforced.

Regression coverage includes hung index calls, stalled JSON bodies, read recovery,
write ambiguity, exhausted request budgets, recoverable challenge failures and
the actual Blob SDK's abort behavior using its mocked HTTP transport.
