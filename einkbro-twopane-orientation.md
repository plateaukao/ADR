2026-07-07

# EinkBro: TwoPaneLayout keeps arrangement and split across orientation

## What was broken

`TwoPaneLayout` (the split-screen container for translation/second pane)
re-ran `initViews()` on every orientation change, and `initViews()` did
three destructive things:

1. Reassigned `panel1`/`panel2` from raw child order — silently reverting
   a user's `switchPanels()` arrangement while
   `config.translation.translationPanelSwitched` still claimed switched.
2. Reset the user-dragged split position (`finalX`/`finalY`) to 50%.
   `initDragHandle()` additionally reset the cross-axis value on each
   orientation toggle, so even a preserved value was wiped on the way
   back.
3. Indexed `userAddedViews[0]/[1]` behind an empty `if (size != 2)` check
   — an ordering-dependent IndexOutOfBounds waiting to happen.

Separately, `onMeasure()` called `updatePanels()`, which assigns new
`LayoutParams` to both panes — `requestLayout()` from inside a measure
pass, forcing extra full-tree layouts, each of which resizes a WebView.

## The fix

- A `panelsSwitched` flag records the arrangement; `initViews()` applies
  it after deriving the panes (the sub-panel pointer stays fixed to the
  translation view regardless of arrangement, matching `hideSubPanel`'s
  expectations).
- Split position is only defaulted when still unset; the existing
  `updateFinalPosition()` clamp handles values that no longer fit. The
  cross-axis resets in `initDragHandle()` are removed.
- `onMeasure` defers `updatePanels()` with `post {}` — the resize happens
  once, after the pass completes.
- `initViews()` returns early with fewer than two panes.

## Verification

Emulator: split screen opened, the divider dragged from center to
x≈322 (verified by pixel-scanning the screenshot), then the split
orientation was toggled horizontal → vertical → horizontal. The divider
returned to exactly x≈322; before the fix it reset to center.
