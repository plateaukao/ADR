2026-07-08

# NerLan: hidden tabs no longer lay out their lists

## What was wasted

`TabContainer` keeps all four tabs composed so their data, filters and scroll
positions survive switching — intentional. But its custom layout measured every
tab at full constraints and only skipped *placement* for inactive ones. Lazy
lists compose their visible items during measure, so:

- at startup all four tabs' LazyColumns composed and measured their rows, and
- whenever hidden rows' observed state changed (the now-playing episode, a
  download progress step), the invisible tabs re-measured along with the
  visible one.

## Fix

Inactive tabs are measured with `Constraints.fixed(0, 0)`. A zero-size viewport
makes a LazyColumn compose no items, so hidden tabs cost nothing per frame,
while the retained composition still preserves their `LazyListState` scroll
positions and loaded data.

## Verification

On the emulator: scrolled the 節目 tab down three pages, switched to 收藏 (its
empty state rendered correctly), switched back — the same three programs sat at
the same pixel offsets, confirming scroll retention. All tabs remain
interactive and correct after switching.

Commit: `9546ec4` in nerlan-android.
