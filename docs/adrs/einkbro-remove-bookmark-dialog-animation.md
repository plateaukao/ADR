# Remove Bookmark Dialog Animation

## Problem
The bookmark list dialog showed animation effects when switching between list/grid view modes and when navigating into/out of bookmark folders. On E-ink devices, these animations cause visible screen refresh artifacts and feel sluggish.

## Root Cause
Three sources of animation:
1. The `ReorderableItem` component (from `sh.calvin.reorderable`) internally applies `Modifier.animateItem()`, causing items to animate on layout changes.
2. The Android WindowManager animates dialog window position changes when the dialog resizes due to content changes.
3. `windowAnimations = 0` was set on the LayoutParams object in-place without calling `window.attributes = ...` to apply it, so it had no effect.

## Solution
1. **`key()` wrapper**: Wrapped the `LazyVerticalGrid` and its states in a `key(folderId, isGridView)` block. When either value changes, Compose fully recreates the grid instead of animating item transitions.
2. **Alpha hide/show**: Added an `OnLayoutChangeListener` on the ComposeView that sets the dialog window's `alpha = 0` when size changes, then restores `alpha = 1` after 300ms, hiding the window movement animation.
3. **Fix windowAnimations**: Changed `window?.attributes?.windowAnimations = 0` to `w.attributes = w.attributes.apply { windowAnimations = 0 }` so the setting is actually applied to the WindowManager.

## Key Files
- `app/src/main/java/info/plateaukao/einkbro/view/dialog/compose/BookmarksDialogFragment.kt` — key() wrapper and layout change listener
- `app/src/main/java/info/plateaukao/einkbro/view/dialog/compose/ComposeDialogFragment.kt` — windowAnimations fix

## Lessons Learned
- `window.attributes` returns the actual LayoutParams reference, but modifying it in-place does NOT notify the WindowManager. You must assign back via `window.attributes = attrs` to apply changes.
- The `sh.calvin.reorderable` library's `ReorderableItem` applies `Modifier.animateItem()` internally, which animates all item layout changes, not just drag-drop.
- Using Compose's `key()` to force recreation is an effective way to bypass internal library animations.
