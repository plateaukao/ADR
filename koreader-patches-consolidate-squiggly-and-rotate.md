2026-08-22

# Consolidate the squiggly and rotated-Japanese-reading patches into koreader-patches-private

Commit `a3a2ba6` in `koreader-patches-private` adds two existing standalone KOReader user
patches so that every personal patch lives in one (private) repo:

- **`2-squiggly-highlight.lua`** — the "Squiggly" wavy-underline highlight style. This is a
  straight move from the former public `koreader-patches` repo: the file is byte-identical
  to that repo's HEAD (`8244193`), and it has been deleted there. It works for both EPUB
  and PDF because both engines render highlights through
  `ReaderView:drawHighlightRect()`; the wave is drawn as 1px rectangle segments along a
  sine curve since the blitbuffer has no curve primitive.
- **`2-cre-rotate-japanese-book.lua`** — the per-book "vertical reading hack" for Japanese
  crengine books. It patches `ReaderRolling` / `ReaderView` to render the page rotated 90°,
  draws highlights, underlines and squiggles in the rotated frame, detects image-only
  pages (cover via the EPUB manifest, otherwise by parsing the page HTML for `<img>` and
  loading the file from the EPUB — the earlier 49-probe pixel sampling segfaulted the JPEG
  decoder, so the probe is now a single center sample) and fixes hold-pan corner scroll for
  rotated coordinates. It is toggled from **Typeset → Toggle vertical reading** and stored
  per book as `vertical_reading_hack`.

Nothing in either file changed; the commit adds README sections and a `CLAUDE.md`
"Current contents" entry for each so the repo's own guidance stays accurate. Both patches
were syntax-checked with `luajit -bl`.

The squiggly patch and the new selection-in-highlight-style patch (see
`koreader-patches-selection-highlight-style.md`) compose at runtime: the selection patch
calls `self:drawHighlightRect` dynamically, so a selection made while "Squiggly" is the
default style is drawn squiggly too, regardless of which patch loaded first.
