# NetflixSubtitleDownloader — EPUB cover picker with custom upload

## Summary

The EPUB export now lets the user **choose** the book cover instead of having
it auto-selected silently. The EPUB dialog presents a thumbnail gallery of every
cover-art candidate Netflix exposes (ordered portrait-first, since a book cover
wants a tall ratio), plus a **"No cover"** option and a **"+ Upload"** tile for
supplying a custom image from disk. The first/best candidate is pre-selected so
the default behaviour matches the old automatic pick.

## Approach

The cover image is only reachable from data Netflix's own page JavaScript
processes, and a multi-episode EPUB navigates across episode pages while
building. Both facts shaped the design:

- **Collect, don't pick.** `processMetadata` previously narrowed `boxart` /
  `artwork` / `storyart` down to a single `coverImageUrl`. It now flattens all
  three lists into an ordered, deduped `coverCandidates` array (portrait first,
  then largest-area), with the Falcor-cache boxart event `unshift`-ed to the
  front and `og:image` as a fallback.
- **Pick at the start, carry through the batch.** The user's choice is captured
  when the dialog's Download button is clicked and stored in the
  `NSD_epub_batch` sessionStorage record (`coverUrl`). This matters because for
  season/all-seasons exports the page reloads between episodes — re-deriving the
  cover per page would lose the choice. The final fetch at batch completion just
  reads `epubBatch.coverUrl`.
- **Selection tracked by tile element, not URL string.** Uploaded images are
  large `data:` URLs; comparing or storing them as DOM attributes was wasteful,
  so the chosen URL lives on a JS property (`overlay._nsdCoverUrl`) and highlight
  state compares tile references.
- **Uploads are downscaled** (`readCoverFile`): images over 1200px on the long
  side are redrawn to a canvas and re-encoded as JPEG q0.9. A full-resolution
  photo serialized into sessionStorage alongside the chapter HTML could exceed
  the roughly 5 MB quota and break the batch mid-run. Small images pass through
  untouched; a decode failure falls back to the raw data URL.
- **Reuse the existing end-of-batch fetch.** `fetch()` handles `data:` URLs
  transparently, and the existing blob-type / WebP→JPEG conversion in
  `processEpubBatchStep` already does the right thing for an uploaded
  PNG/JPEG/WebP — no special-casing was needed.

## Trade-offs

- **Cover chosen up front, not previewed in context.** The user picks before the
  (potentially long) batch runs, so they don't see the cover composited with the
  generated text first. Accepted: picking mid-batch would mean pausing the
  navigation loop for input.
- **Custom uploads are recompressed to JPEG when large.** Slight quality loss and
  loss of transparency, in exchange for bounded sessionStorage size. Covers don't
  need alpha, so this is a safe default.
- **Thumbnails display via `<img src>` (no CORS) but the final cover is fetched
  with `{mode:'cors'}`.** In the rare case a candidate renders but its CORS fetch
  is blocked, that candidate would yield no cover; the user can pick another or
  upload one.

## Key Files

- `content.js`
  - `processMetadata` — builds `coverCandidates` (was single `coverImageUrl`).
  - `addCoverCandidate` — dedup helper; `boxart` event handler unshifts to front.
  - `buildCoverGrid` — renders the thumbnail gallery, upload tile, and "No cover";
    tracks selection on `overlay._nsdCoverUrl`.
  - `readCoverFile` — reads + downscales an uploaded image to a data URL.
  - `downloadAsEpub` / `processEpubBatchStep` — thread `coverUrl` through the
    `NSD_epub_batch` sessionStorage state and fetch it at completion.
  - `MENU_CSS` — `.nsd-cover-*` styles for the grid.
