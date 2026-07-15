2026-07-07

# EinkBro: don't rebuild the context menu model per hover change

## What was broken

The link long-press context menu supports drag-to-select: while the finger
is down, every touch move writes `hoveredItemState`, recomposing
`ContextMenuItems`. That composable rebuilt its entire menu model —
`createMenuLayout()` allocating about 11 `MenuItemConfig` objects plus two lists
— and re-ran `URLDecoder.decode(url, "UTF-8")` on every hover change, i.e.
continuously while the user drags. The fragment's non-compose hit-testing
path (`determineHoveredItem`) *also* called `createMenuLayout()` per touch
move.

## The fix

- In the composable: `remember(isEbookMode) { createMenuLayout(...) }` and
  `remember(url) { URLDecoder.decode(...) }` — hover changes now only flip
  the `isHovered` flag on the affected items.
- In the fragment: the hit-testing copy of the layout is a `by lazy` field
  (`isEbookMode` is a constructor val, so it can't change).

## Verification

Emulator: long-pressing a link opens the menu with both rows intact
(New tab / background / Open with / Split screen / Share on the first row;
Select text / Read content / Save as / Summarize on the second).
