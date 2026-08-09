2026-08-09

# EinkBro: Scrolling the start-page suggestion list activated the row under the finger

With the start-page search bar focused and history suggestions showing, trying to scroll the list also clicked whatever row the scroll gesture started on — a swipe would suddenly navigate away.

## Root cause

Suggestion rows navigated on **`pointerdown`**. That event was chosen deliberately: it fires before the input's `blur` (which hides the list after a grace period), so a tap could win the race. But `pointerdown` also fires at the start of every scroll gesture — touching the list to pan it was indistinguishable from tapping a row, and navigation fired immediately.

## Fix

Split the two responsibilities the old handler conflated:

- `pointerdown` now only calls `preventDefault()` — this stops the input from losing focus, so the list stays open. Canceling `pointerdown` does not inhibit scrolling.
- Navigation moved to `click`, which the browser fires only for a genuine tap. A pan gesture takes over the pointer stream and ends in `pointercancel`, so no `click` — and no accidental navigation — ever happens while scrolling.

This leans on the browser's own tap-vs-scroll disambiguation (touch slop and all) instead of hand-rolling movement thresholds. Verified on the emulator: swiping over the open list scrolls without navigating, and tapping a row still loads the page.
