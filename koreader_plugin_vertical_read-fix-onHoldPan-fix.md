# Fix: Cross-Page Text Selection in Vertical Reading Mode

**Date:** 2026-04-05
**Project:** koreader_plugin_vertical_read
**Commit:** 5341670

## Problem

When selecting text across pages in vertical reading mode (rotated 90 degrees for Japanese vertical text), dragging to the corner of the screen triggered a page scroll, but the highlight/selection position drifted incorrectly after scrolling.

## Root Cause

In KOReader's `onHoldPan`, after a corner scroll, `hold_pos.y` is adjusted using the first return value of `getScreenPositionFromXPointer`. In the vertical reading plugin's rotated coordinate system:

1. **Wrong return value used:** The plugin's overridden `getScreenPositionFromXPointer` returns `(doc_x, rotated_screen_x)`. The first value (`doc_x`) does NOT change with scroll, making the `hold_pos.y` adjustment a no-op.
2. **Wrong axis adjusted:** In rotated mode, document scroll moves content along the **screen X axis**, so `hold_pos.x` should be adjusted, not `hold_pos.y`.

## Solution

Wrapped `onHoldPan` with a thin decorator instead of reimplementing the entire function:

- **Before call:** Save `hold_pos.x` and capture the current screen X position (second return value from `getScreenPositionFromXPointer`) and document position.
- **Delegate:** Call the original `onHoldPan` for all logic (corner detection, text selection, scrolling).
- **After call:** If document position changed (corner scroll happened), compute the correct `hold_pos.x` delta using the second return value of `getScreenPositionFromXPointer`.

This approach:
- Keeps all original corner detection and text selection logic intact.
- Does not break normal (non-vertical) reading mode, since it delegates directly to the original function.
- Uses a `local` variable for the saved original to avoid global pollution.

## Key Files

- `2-cre-rotate-japanese-book.lua` — the `onHoldPan` wrapper at the end of the file

## Lessons Learned

- Avoid reimplementing large upstream functions when only a small fix is needed — wrap and fix up instead.
- The rotated `getScreenPositionFromXPointer` returns two values with different semantics; the second tracks the scroll-affected screen position.
