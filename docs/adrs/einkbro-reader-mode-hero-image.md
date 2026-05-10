# EinkBro — Hero Image Missing in Reader Mode

## Problem

On nu.nl articles (e.g. the ChipSoft patient-data breach article at
`https://www.nu.nl/tech/6392840/...`), entering reader mode dropped the large
hero image at the top of the article. Only the author's portrait rendered,
giving the impression reader mode was broken or at least inconsistent.

## Root Cause

Two separate filters inside the bundled `MozReadability.js` (Firefox
Readability fork, `app/src/main/assets/MozReadability.js`) conspired:

1. **`_isProbablyVisible` drops `aria-hidden="true"` nodes** (line 2758).
   nu.nl puts `aria-hidden="true"` on the hero `<img>` because the image has
   a text caption overlay — their DOM treats the overlay as the semantic
   content, so the image is marked decorative for screen readers. Readability
   interprets `aria-hidden="true"` as "invisible" and removes the node in the
   pre-scoring pass (line 1071).

2. **`_grabArticle` strips unlikely candidates** (line 1129). The wrapping
   `<figure>` has class `app-figure--caption-overlay image-header-block
   image-block--stretched`. The `unlikelyCandidates` regex matches `header`
   from `image-header-block`; the `okMaybeItsACandidate` bypass regex
   (`article|body|column|content|main|shadow|and`) doesn't match any token in
   the class list, so the whole figure is removed.

Removing only `aria-hidden` still left the hero gone — the figure was still
dropped. Removing only the class still left the img filtered by visibility.
Both fixes were needed.

## Investigation

Used Chrome DevTools Protocol over `adb forward` on the emulator's WebView
DevTools socket to inspect the live DOM before and after reader mode toggle.
This revealed:

- Pre-reader-mode: hero img at idx 0 with `aria-hidden="true"` inside a
  `<figure class="...image-header-block...">`.
- Post-reader-mode: only 1 img remained — the author portrait. Hero was gone.
- Experimental toggle: stripping `aria-hidden` alone → hero still missing.
  Stripping `aria-hidden` + `image-header-block` → hero restored.

Chrome 138+ requires a specific Host header for the DevTools WebSocket, which
meant the standard `websockets` / `websocket-client` Python libraries got
HTTP 403 on handshake. Worked around with a raw socket client
(`/tmp/cdp_raw.py`) that sends the handshake verbatim with
`Host: 127.0.0.1:9222`.

## Solution

Two small patches in `app/src/main/assets/MozReadability.js`:

1. **At the top of `parse()`**, strip `aria-hidden="true"` from all `<img>`
   and `<picture>` elements on the cloned document. The attribute is a
   screen-reader hint, not a visibility flag — stripping it prevents the
   visibility check from dropping decorative-looking hero images.

2. **In `_grabArticle`'s unlikely-candidates block**, add `FIGURE` and
   `PICTURE` to the list of tags that are never removed even when their
   class matches the regex. This covers sites using wrappers named like
   `article-header`, `story-header`, `post-header-image`,
   `header-image`, etc. — not just nu.nl's `image-header-block`.

Verified end-to-end on the Pixel 7 API 34 emulator: reloaded the nu.nl
article in EinkBro, triggered reader mode, and the ChipSoft hero image now
renders as the first image above the author portrait and body text.

## Key Files

- `app/src/main/assets/MozReadability.js`
  - `parse()` pre-processing — strip `aria-hidden` on `img`/`picture`.
  - `_grabArticle()` unlikely-candidates check — spare `FIGURE`/`PICTURE`.

## Lessons Learned

- Readability's `_isProbablyVisible` treats `aria-hidden="true"` strictly, but
  that attribute is widely misused on hero images with caption overlays. For
  a reader/reading-list use case, stripping it from media elements is strictly
  better than honoring it.
- The `unlikelyCandidates` regex is blunt — any class containing `header`
  (including non-nav semantic classes like `article-header` or
  `image-header-block`) triggers removal. Using a tag allowlist
  (`FIGURE`/`PICTURE`) to opt out of the filter is safer than loosening the
  regex, since a later pass in Readability still prunes figures that end up
  with no real content.
- For debugging WebView DOM, `adb forward` + Chrome DevTools Protocol is far
  faster than round-tripping through app rebuilds with `console.log`. Chrome
  138+'s Host-header check on the WebSocket upgrade means you need a raw
  socket client, not `websockets` / `websocket-client`.
- Two-cause bugs need verification of each cause independently — fixing only
  one would have made the test still fail and invited reverting the correct
  patch.
