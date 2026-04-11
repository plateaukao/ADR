# Fix: Restore Long-Press Text Selection When Ebook Touch Pagination Is Disabled

## Problem

Long-press text selection didn't work when the touch area type was set to Ebook, even with touch pagination disabled. Switching to any other pagination type restored text selection.

## Root Cause

Two independent issues:

1. **JS listener leak**: `ebook_touch.js` registered `touchstart`, `touchmove`, `touchend`, and `click` listeners in capture phase. When disabled, only a flag (`__einkbroEbookTouchEnabled`) was set to `false` — the listeners were never removed. Non-passive capture-phase touch listeners force the WebView to wait for JavaScript before processing native gestures, blocking long-press detection.

2. **Unconditional `clickLinkElement` call**: In `BrowserActivity.onLongPress()`, when `touchAreaType == Ebook` and the long-press wasn't on a link, `clickLinkElement()` was called regardless of whether pagination was enabled. This consumed the long-press event, preventing native text selection.

## Solution

1. Refactored `ebook_touch.js` to use named function references and a `__einkbroEbookTouchCleanup` function that calls `removeEventListener` for all four listeners. `EBWebView.toggleEbookTouchMode(false)` now invokes the cleanup function instead of setting a flag.

2. Added `config.enableTouchTurn` guard to the `clickLinkElement` call in `BrowserActivity.onLongPress()`, so it only fires when ebook pagination is actually enabled.

## Key Files

- `app/src/main/assets/ebook_touch.js`
- `app/src/main/java/info/plateaukao/einkbro/view/EBWebView.kt`
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt`

## Lessons Learned

- Setting a flag to disable JS event handlers is not enough — non-passive capture-phase listeners still interfere with native gesture recognition. Always use `removeEventListener` to fully clean up.
- When gating behavior on a mode (e.g., Ebook), also check whether the specific feature within that mode is enabled, not just the mode itself.
