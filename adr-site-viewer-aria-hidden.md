2026-07-18

# ADR Site: Viewer Kept aria-hidden="true" While Open

## What was broken

Opening an ADR on the site and switching a browser into reader mode produced
garbage: instead of the article, Readability-based readers extracted a string
of calendar-grid noise ("SunMonTueWedThuFriSat…"). Screen readers had the
same blind spot — the open article did not exist for them.

## Root cause

`index.html` hard-codes `aria-hidden="true"` on the `<aside id="viewer">`
overlay, which is correct for its initial hidden state. But `openEntry()`
revealed the viewer by removing only the `hidden` class (the CSS hides it
via a transform), and never touched `aria-hidden`. So the DOM permanently
declared the article hidden even while it was the only thing on screen.

Consumers that honor the attribute do the right thing with that wrong
information: Mozilla Readability's `_isProbablyVisible` discards any
`aria-hidden="true"` subtree before scoring, so the whole article dropped
out and only the calendar shell was left to extract. Verified both ways on
the live page: with the stale attribute, Readability returned 148 characters
of grid noise; with the attribute cleared, the identical call returned the
full ~4,000-character article.

## Fix

Keep the attribute in sync with visibility in `docs/app.js`
(commit `45423da`): `openEntry()` sets `aria-hidden="false"`, and
`closeViewer()` sets it back to `"true"`. Verified on-device that reader
mode now extracts the complete article and the attribute round-trips
correctly through open and close.
