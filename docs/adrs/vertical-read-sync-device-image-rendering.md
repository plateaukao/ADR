# vertical-read: sync device's image-only page rendering into repo

Commit: `2506ccc` — "sync: adopt device's image-only page rendering for vertical mode"

## Summary

The `2-cre-rotate-japanese-book.lua` patch running on the e-ink device
(`/sdcard/koreader/patches/`) had diverged ~200 lines ahead of the
repo's latest committed version. The extra code was hand-debugged work
(JPEG-decoder segfault workaround, alpha-blit fix) that had never been
pushed back to git and existed nowhere but the device — i.e. unbacked.
This commit adopts the device state as the new committed baseline so
the repo is finally the latest.

## Approach

Three versions existed: an old stale copy in an untracked `patches/`
subfolder (~411 lines), the repo's tracked root file on `main` (445
lines), and the device file (647 lines). The device was newest. Pulled
the device file, verified `luac -p`, and committed it over the tracked
root path `2-cre-rotate-japanese-book.lua`. Only that one file was
staged — untracked noise (`.DS_Store`, `.idea/`, the stale `patches/`
copy) was deliberately left out so the commit is focused.

New for vertical reading mode in the adopted version:
- `currentPageHasText()` + `page_has_text_cache` — text vs image-only
  page detection, cached by xpointer
- `imageHasContent()` — pixel sampling to reject all-white/black blanks
- `getCoverImage()` — EPUB cover via manifest (reliable for page 1)
- `extractImagePaths()` / `loadImageFromBook()` — parse `<img src>` and
  load the image straight from the EPUB with path normalization
- `extractPageImageFromHTML()` / `extractPageImage()` — fallback
  extraction using a single center probe, deliberately avoiding a
  49-probe loop that segfaulted the JPEG decoder
- `drawCurrentView()` — flags `is_image_only` and composites onto an
  opaque white buffer so alpha doesn't kill the blit

## Trade-offs

- Adopted the device file wholesale rather than cherry-picking, since
  it was the only source of truth for the unbacked work and was known
  to run on real hardware. The intermediate `main` (445-line) state is
  preserved in history if a bisect is ever needed.
- The stale untracked `patches/` copy was left in place (not the user's
  to delete without confirmation); it remains a potential source of
  confusion until reconciled separately.

## Key Files

- `koreader_plugin_vertical_read/2-cre-rotate-japanese-book.lua` —
  tracked root path, now the device baseline
- `/sdcard/koreader/patches/2-cre-rotate-japanese-book.lua` — device
  copy this was synced from
