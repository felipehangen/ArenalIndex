# Automatic photo preparation

The listing editor prepares public-tour photos automatically. Owners choose the cover and classify photos as before; there are no cropping or rotation controls. The publishing guide explains this in Spanish and English. Standard listing rules and their recorded acceptance remain unchanged.

- Input: JPEG, PNG or WebP, up to 32 MiB per photo; HEIC still requires a JPG export. Check the encoded dimensions before browser decoding: at most 60 million pixels and 16,384 pixels per side.
- Apply camera orientation, preserve the full frame and aspect ratio, never upscale, and resize to at most 2,000 pixels on the longest side. Encode as JPEG on white for transparency, starting at quality 85 and trying 76/66 when above a 600 KiB target. The target is not a hard per-photo byte limit; the existing 12 MiB stored-file limit still applies.
- Only prepared bytes count toward the 60 MiB listing budget. Process files sequentially and release bitmap/canvas memory after each one.
- Skip identical prepared-photo hashes within the listing; show a persistent explanation for skipped/invalid files. Warn, without blocking, about small or extremely narrow images. Keep source filenames out of automatic UI translation.
- PDF files and documentary images retain their original bytes and 12 MiB input limit. Never resize cadastral plans for publication: document groups remain private.

The server independently checks actual byte count, media type, pixel limits and successful decoding with Sharp. Signature checks alone are insufficient. Existing approval and publication controls are unchanged.

Before a reviewer previews or publishes an approved version, generate private, immutable JPEG derivatives at `<original-storage-path>/web-v1.jpg`. This also optimizes older drafts and uploads that bypassed browser preparation. Only these generated images enter a new public snapshot. Default Sharp output drops metadata, including EXIF/GPS; camera orientation is baked into the pixels. Reuse an existing derivative for the same immutable source. Keep source objects and all existing published snapshots untouched. Existing listings receive derivatives the next time they are published, not through a bulk migration.

Deployment uses the existing Vercel API and GitHub Pages frontend. Deploy the API before the frontend. Sharp is pinned in package.json/package-lock.json; its platform-specific binaries are installed by npm on Vercel and CI. No new environment variables or database migration are needed.

Tests exercise actual image decoding, corrupt payloads, oversized headers, automatic orientation, metadata removal, preserved dimensions, transparency, upload budgets, duplicate handling, documents, immutable derivative reuse and the publication workflow. The browser canvas adapter is a unit-test substitute, not browser QA. Interactive browser QA was unavailable because local browser access was disabled in Work settings.
