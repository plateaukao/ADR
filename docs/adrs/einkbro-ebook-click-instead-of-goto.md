# EinkBro: Change Ebook "Go to" to simulate click

## Problem
In Ebook mode, the "Go to" context menu action navigated directly to the link URL via `loadUrl()`. This broke links that trigger in-page JavaScript actions (expand/collapse, AJAX calls, etc.) instead of actual navigation.

## Root Cause
`ebWebView.loadUrl(url)` bypasses the page's event handlers entirely, treating every link as a navigation target regardless of its actual behavior.

## Solution
Replace `loadUrl(url)` with a simulated native click at the long-press point:
1. Temporarily disable `ebook_touch.js` interception (`__einkbroEbookTouchEnabled = false`) to prevent the simulated touch from triggering page up/down.
2. Use `simulateClick(point)` to dispatch native `ACTION_DOWN`/`ACTION_UP` events, providing proper press/release visual feedback.
3. Re-enable ebook touch handling after 200ms.

Also renamed the menu item from "Go to" (ArrowForward icon) to "Click" (Fingerprint icon) to better reflect the new behavior.

## Key Files
- `app/src/main/java/.../view/EBWebView.kt` — Added `clickLinkElement(point)` method
- `app/src/main/java/.../activity/BrowserActivity.kt` — Changed GotoLink handler to use `clickLinkElement`
- `app/src/main/java/.../view/dialog/compose/ContextMenuDialogFragment.kt` — Updated icon to Fingerprint
- `app/src/main/res/values/strings.xml` — Changed "Go to" string to "Click"

## Lessons Learned
- `window._touchTarget` (set on every touchstart via NinjaWebViewClient) reliably tracks the nearest `<a>` ancestor, useful for link-related operations.
- `ebook_touch.js` respects the `__einkbroEbookTouchEnabled` flag, making it safe to temporarily bypass for programmatic clicks.
- Native `simulateClick` (dispatching MotionEvents through ViewGroup) is preferable to JavaScript `.click()` because it triggers proper CSS `:active` state transitions and visual press/release feedback.
