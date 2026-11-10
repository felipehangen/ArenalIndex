# Property sharing

Public property links use `https://go.arenalindex.com/p/<code>` (39 characters including HTTPS). The code is derived from the existing public ID and stays unchanged after edits. The handler checks for collisions and never picks an arbitrary match. Original `/#propiedad/<id>` links continue to work.

GitHub Pages still hosts the main site. The `go` subdomain points to the existing `arenalindex-intake` Vercel project. `/p/:code` serves a 200 HTML response containing Open Graph metadata before any JavaScript runs; a normal browser then opens the property on the main site. Without JavaScript, the page still has the title, summary, photo, and a usable property link. No bot-specific response or HTTP redirect strips the metadata from WhatsApp.

The preview image uses `listing.images[0]`, the selected published cover, center-cropped to a 1200×630 JPEG. A small dark-green Arenal Index wordmark is centered near the bottom so it also survives a centered square crop. Demos get a visible demonstration label; real listings do not. Price, original currency, locality and area appear in the preview description. Missing photos use a neutral graphic, never another property's photo. Broken photo downloads return a retryable error rather than caching a substitute image.

Both HTML and image requests read the current managed public catalog, including withdrawals/deletions. Private records, documents, contacts and tokens are never projected into the page. Only owned public photo paths and their Vercel Blob redirects are fetched, with time/byte/pixel limits. Metadata responses and image responses use `no-store`; WhatsApp can still retain its own earlier previews, and already sent messages cannot be remotely updated or removed. Changing a cover changes the image version URL for future crawls.

The public catalog adds `shareUrl`; the client accepts only the branded or existing backend origin and the expected route format. The share dialog, WhatsApp inquiry and email inquiry use this canonical URL instead of copying arbitrary address-bar queries. Private buyer previews still cannot be shared. Cached clients or older APIs retain the original hash-link fallback.

## Deployment

1. Add `go.arenalindex.com` to the existing Vercel project. This was completed on November 10, 2026.
2. Add the GoDaddy CNAME record `go` → `0a1a9b0fccfa844f.vercel-dns-016.com` (Vercel's verified recommendation). Keep the apex, `www`, nameservers and other records unchanged.
3. Verify DNS and HTTPS using `vercel domains verify go.arenalindex.com` and a real HTTPS request.
4. Set Vercel Production `PUBLIC_SHARE_ORIGIN=https://go.arenalindex.com` and deploy the API. Until enabled, the backend uses its existing `https://arenalindex-intake.vercel.app` origin so no broken DNS links reach visitors.
5. Publish the frontend through GitHub Pages; verify the live catalog URL, share HTML, image, JPEG dimensions and missing-property 404. No listing mutation or database migration is needed.

Initial validation: 309 tests passed and build passed. `tests/sharing.test.mjs` covers stable links, collisions, crawler-visible metadata, browser redirect, escaping, withdrawals, image generation and fetching, contact links, and private-preview guards. Actual WhatsApp client rendering remains a device check because its layout and cache behavior are controlled by WhatsApp.
