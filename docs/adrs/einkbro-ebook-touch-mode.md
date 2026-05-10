# EinkBro: Ebook Touch Mode

## Problem

The existing touch pagination modes (Left, Right, Middle, Bottom, Two sides) all use overlay Android Views placed on top of the WebView. These overlays block interaction with underlying web content and don't behave like natural ebook page-turning where tapping anywhere on the left/right half of the page scrolls up/down.

Users wanted a reading mode where:
- Tapping the left half of any content scrolls up (page up)
- Tapping the right half scrolls down (page down)
- Long press on a link shows a context menu with a "Go to" option (since normal taps no longer follow links)
- Long press on non-link content still allows text selection

## Root Cause

Android WebView handles link navigation at the native touch level, before JavaScript `click` events fire. A pure JS `click` event handler with `preventDefault()` cannot stop WebView from navigating to links. This required a dual-interception strategy: `touchend` for scroll triggering + `click` capture for blocking link navigation.

## Solution

Added a new `Ebook` value to `TouchAreaType` enum with a completely different approach — JavaScript-based touch handling inside the WebView instead of overlay Views.

### Key implementation details:

1. **`ebook_touch.js`**: Injected into every page load. Uses `touchstart`/`touchmove`/`touchend` listeners in capture phase to detect single taps. A separate `click` capture listener blocks link navigation when a tap was handled. Long presses (>400ms) pass through for native text selection/context menu.

2. **`JsWebInterface.ebookPageUp()/ebookPageDown()`**: `@JavascriptInterface` methods called from JS that delegate to existing `pageUpWithNoAnimation()`/`pageDownWithNoAnimation()`, respecting the `switchTouchAreaAction` config.

3. **`TouchAreaViewController`**: Ebook case returns early from `updateTouchAreaType()`, skipping all overlay view setup. Guards added to `toggleTouchPageTurn()` and `maybeDisableTemporarily()` to prevent crashes when overlay views aren't initialized.

4. **Context menu**: In Ebook mode, "Copy link" is replaced with "Go to" (loads URL in current tab), since tapping links is disabled.

5. **Toggle support**: JS uses a `window.__einkbroEbookTouchEnabled` flag that can be toggled from Android without re-injection, respecting the touch pagination on/off setting.

6. **Action mode dismiss**: In Ebook mode, tapping while text selection action mode is active dismisses it instead of scrolling. The JS calls `androidApp.dismissActionMode()` which checks `BrowserController.isActionModeActive()` and calls `dismissActionMode()` (clears selection + finishes action mode) if active.

7. **removeTextSelection() bugfix**: Fixed a pre-existing bug where `w.getSelection()` should have been `window.getSelection()`. The undefined `w` caused a silent JS error, leaving text selection highlights visible after action mode actions.

## Key Files

- `app/src/main/assets/ebook_touch.js` — JS touch interception logic
- `app/src/main/java/.../preference/TouchAreaType.kt` — Added `Ebook` enum value
- `app/src/main/java/.../browser/JsWebInterface.kt` — `ebookPageUp()`/`ebookPageDown()` bridge
- `app/src/main/java/.../browser/WebContentPostProcessor.kt` — JS injection on page load
- `app/src/main/java/.../view/EBWebView.kt` — `toggleEbookTouchMode()` method
- `app/src/main/java/.../view/viewControllers/TouchAreaViewController.kt` — Ebook bypass for overlays
- `app/src/main/java/.../view/dialog/compose/ContextMenuDialogFragment.kt` — "Go to" menu item
- `app/src/main/java/.../view/dialog/compose/TouchAreaDialogFragment.kt` — UI for Ebook option
- `app/src/main/java/.../browser/BrowserController.kt` — `isActionModeActive()`/`dismissActionMode()` interface
- `app/src/main/java/.../activity/BrowserActivity.kt` — Preference listeners, GotoLink handler, action mode dismiss
- `app/src/main/res/drawable/ic_touch_ebook.xml` — Icon (single vertical line divider)

## Lessons Learned

- Android WebView's native link handling fires before JS `click` events — `preventDefault()` on `click` alone is insufficient. Need to intercept at `touchend` AND `click` levels.
- When adding a new touch mode that skips overlay initialization, all methods that access overlay views (`toggleTouchPageTurn`, `maybeDisableTemporarily`) must be guarded.
- JS flags (`window.__einkbroEbookTouchEnabled`) are an effective way to toggle injected behavior without full re-injection or page reload.
- When JS-based touch handling intercepts all taps, UI states like action mode need explicit dismiss handling — the tap never reaches the Android view layer to trigger normal dismiss logic.
- Typos in injected JS (`w` vs `window`) fail silently in `evaluateJavascript` — no crash, no log, just broken behavior. Always test injected JS carefully.
