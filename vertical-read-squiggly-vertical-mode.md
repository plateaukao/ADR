# vertical-read: squiggly highlight style in vertical reading mode

Commit: `d5019a3` — "feat: squiggly highlight style in vertical reading mode"

## Summary

The standalone `koreader-squiggly-highlight` patch adds a "Squiggly"
highlight style by wrapping `ReaderView:drawHighlightRect`. In vertical
reading mode the vertical-read patch *wholesale replaces*
`drawHighlightRect` with a rotated dispatcher that re-implements each
style as a 90°-rotated shape — and it had no `"squiggly"` branch, so a
squiggly highlight drew nothing while vertical mode was on. This commit
adds the missing rotated branch.

## Approach

Mirrored the existing rotated styles. The rotated underscore is a
vertical bar at `x + w - 12` (the side of the glyph column). The new
`elseif drawer == "squiggly"` branch reuses that exact anchor but
oscillates x by `amp * sin(2π·j / wlen)` while stepping `j` down the
column height — a vertical sine wave parallel to where the rotated
underscore sits. Same `amp` / `wlen = amp*6` / `thick` parameters as
the horizontal squiggle, so both orientations look identical.

The fix lives in the vertical-read patch (not the squiggly patch)
because that patch fully owns highlight rendering when vertical mode
is active; every other rotated style variant already lives there.
Horizontal mode is unaffected — the vertical patch delegates to the
squiggly patch's wrapper when the vertical hack is off.

## Trade-offs

- Couples the vertical-read patch to a style name (`"squiggly"`)
  defined by a separate patch. Acceptable: the branch is inert unless
  that drawer is selected, and keeping all rotated-style logic in one
  dispatcher matches the patch's existing structure.
- Built on top of the freshly-synced device baseline (commit
  `2506ccc`) and kept as a separate commit so the squiggly feature is
  isolated from the larger image-rendering sync.

## Key Files

- `koreader_plugin_vertical_read/2-cre-rotate-japanese-book.lua` —
  added the rotated `"squiggly"` branch in the vertical
  `drawHighlightRect` replacement
- `koreader-squiggly-highlight/2-squiggly-highlight.lua` — the
  standalone patch that defines the style and the horizontal renderer
