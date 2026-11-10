# Chrome QA follow-up — November 10, 2026

Source: the user's `arenalindex-qa-2026-11-10.zip`, containing `REPORT.md` and 31 screenshots. The report and both failure screenshots were reviewed. This follows the fixes in [QA-FIXES-2026-11-10.md](QA-FIXES-2026-11-10.md).

## External results

All eight requested checks passed for the behavior tested: complete map group membership, total/per-land-m² price filters in USD and CRC, Google widget locale including loading races, land-area accessible names, singular photo counts, Saved empty messages, filter overflow controls, and mobile Sort/Saved keeping the map covered.

The reviewer could not compare the sorting icon against the previous release. Independently, its complete SVG matches the previous production source exactly: three descending horizontal bars, path `M4 6h16M4 12h10M4 18h3`. It remains unchanged.

The report used Chrome at 1084 × 649 CSS pixels. Mobile checks used a same-origin 390 × 649 iframe, without touch input or a mobile user agent. Wide-screen overflow used page zoom. These results do not constitute real iPhone/Safari testing. No account or listing data was changed; the temporary saved property was removed afterward.

## Remaining issues corrected

The report found one additional failure: switching language while the gallery remained open translated the dialog title/counts but left photo-group headings, navigation labels and enlarged-photo captions in the previous language. These strings were captured when opening the gallery and excluded from generic translation to protect listing content.

The gallery now regenerates its localized copy from the original listing on each language change. Headings, navigation labels, image alternatives, enlarge-button names and the current caption update in place. Image nodes, selected photo, overview/enlarged state, gallery scroll and focus remain intact. Closing the gallery removes its language listener. The underlying detail no longer takes focus from an open dialog. Generic galleries without structured photo groups also localize their fallback labels/captions. Existing building names remain literal.

Price numeric-input accessible names now translate synchronously when sliders/currency change. The initial price-per-m² label includes the unit only once. Spanish source labels are still retained by the translation layer, so switching back remains reversible.

The map retaining its current zoom after filtering is established browsing behavior; Whole area remains available. The Saved results heading counts matching results while the navigation counter counts all saved properties. Neither behavior was changed.

## Validation and scope

- **266 tests passed**, zero failures; production build and `git diff --check` passed.
- Regression tests load the actual detail controller and translation layer, covering repeated ES/EN changes, overview and enlarged views, unchanged image nodes/position/focus, closed-dialog listener cleanup, literal building names and ungrouped galleries.
- Actual homepage controller tests check initial and immediate post-slider/currency accessible names, including both languages and reversible changes without waiting for the mutation observer.
- Cache versions updated on the homepage and private buyer preview.
- Frontend-only change; no API deployment, listing/account changes or DNS changes.
- This session's browser connection remained unavailable; the report supplies the external visual evidence. Use [the focused verification prompt](CLAUDE-CHROME-GALLERY-QA-2026-11-10.md) for a visual check of this correction.

The existing real listing's 1,000 m² declared versus 69 m² reviewed plan area still requires factual verification before changing its data.
