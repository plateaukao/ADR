# Fix: "Select Text" Context Menu and Action Mode Dismiss in Ebook Mode

## Problem

Two related issues with the "Select Text" context menu action:

1. **"Select Text" did nothing**: Long-pressing a link and choosing "Select Text" from the context menu failed to select the link's text. Instead, it behaved as if pressing the link itself.

2. **Action mode not dismissed in ebook mode**: After text was selected (by any means), tapping outside the custom action mode menu in ebook mode triggered page pagination instead of dismissing the menu.

## Root Cause

### Bug 1: Undefined JS variable `w`
In `EBWebView.selectLinkText()` and `simulateLongClick()`, the injected JavaScript referenced `w._touchTarget` and `w._hrefAttr`, but `w` was never defined in the WebView's JS context. The touchstart listener in `NinjaWebViewClient.kt` correctly stored the target on `window._touchTarget`. The `ReferenceError` caused the entire IIFE to fail silently, so the link's `href` attribute was never removed before the simulated long-press. The WebView therefore treated the simulated press as a link action, not text selection.

This bug existed since the feature was first introduced (commit 37e3c8e, labeled "partially works") but was never caught.

### Bug 2: `isInActionMode()` only checked system ActionMode
When `showDefaultActionMenu` is `false`, `onActionModeStarted()` calls `mode.finish()` immediately after registering the mode, which nulls out the `actionMode` reference. The custom Compose-based action menu is then shown via `showActionModeView()` which sets `_shouldShow = true`. However, `isInActionMode()` only checked `actionMode != null`, ignoring the visible custom menu. The ebook pagination guard in `EBWebView.dispatchTouchEvent()` therefore fell through.

## Solution

1. **EBWebView.kt**: Replaced all `w.` references with `window.` in the JavaScript snippets within `selectLinkText()` and `simulateLongClick()`.

2. **ActionModeMenuViewModel.kt**: Changed `isInActionMode()` from `actionMode != null` to `actionMode != null || _shouldShow.value`, so it returns `true` when the custom action mode menu is visible even after the system ActionMode has been finished.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/view/EBWebView.kt` - JS fix in `selectLinkText()` and `simulateLongClick()`
- `app/src/main/java/info/plateaukao/einkbro/viewmodel/ActionModeMenuViewModel.kt` - `isInActionMode()` check
- `app/src/main/java/info/plateaukao/einkbro/browser/NinjaWebViewClient.kt` - touchstart listener (reference, unchanged)
- `app/src/main/java/info/plateaukao/einkbro/activity/delegates/ActionModeDelegate.kt` - action mode lifecycle (reference, unchanged)

## Lessons Learned

- When injecting JavaScript via `evaluateJavascript`, always use `window` explicitly; shorthand variables like `w` are not standard and will throw `ReferenceError` silently inside IIFEs.
- When a system callback object (like `ActionMode`) is finished early to replace it with a custom UI, the "is active" check must account for the custom UI's visibility, not just the system object's lifecycle.
- Original commit messages like "partially works" are worth investigating -- the partial failure may have persisted indefinitely.
