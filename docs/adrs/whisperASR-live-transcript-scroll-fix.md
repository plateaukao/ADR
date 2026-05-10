# whisperASR — Live Transcript Scroll & Drag Fix

Commit: `fa56d62` on `main`.

## Problem

In the recording window with live transcription enabled, two unrelated UI issues made the transcript list frustrating to use:

1. **Auto-scroll ignored user intent.** Scrolling up during active transcription did not hold — each new segment snapped the view back to the bottom, even well past the 150px "forgiveness" threshold that was supposed to let users pin to a position.
2. **Scrollbar was dead.** The window had been made draggable (single-finger click-drag anywhere in the transcript area). But clicking on the scrollbar thumb started a window drag instead of scrolling; the scrollbar could not be interacted with at all.

## Root Cause

**Issue 1 — two bugs stacked on top of each other:**

- *Observer setup raced with view construction.* `ScrollPositionObserver` (an `NSViewRepresentable` attached as the List's `.background`) looked up the underlying `NSScrollView`/`NSTableView` from `viewDidMoveToWindow` and a single `DispatchQueue.main.async`. If the List's backing scroll view wasn't in the view hierarchy at both of those moments, `setupIfNeeded` returned without setting `isSetUp = true`, and nothing retried. `updateNSView` would only re-invoke it when the `$isAtBottom` binding changed — but the binding can't change without a working observer, so `shouldAutoScroll` stayed at its default `true` forever. Every new segment triggered an auto-scroll.
- *State update raced with segment arrivals.* Even when the observer did attach, `scrollViewDidScroll` updated `isAtBottom` via `DispatchQueue.main.async`. When a user scrolled up at the same tick as a new segment arrived, SwiftUI's `onChange(liveSegments.count)` ran before the async flag-flip landed, read the stale `shouldAutoScroll = true`, and scrolled back.

**Issue 2:** `WindowDragOverlay` is a transparent `NSView` placed over the List (via `.overlay { ... }`) to capture click-drag for `window.performDrag(with:)`. Its `mouseDown(with:)` unconditionally started the drag, so clicks on the scrollbar never reached the `NSScroller` underneath.

## Solution

All changes in `Sources/RecordingView.swift`.

1. **Retry observer setup.** Renamed `setupIfNeeded` → `attemptSetup`. If the scroll view isn't findable yet, schedule another attempt after 100ms (up to 30 tries = 3 seconds), so the observer reliably attaches once the NSTableView appears.
2. **Close the state-update race.** Write `isAtBottom` synchronously from `scrollViewDidScroll` when already on main (guarded with an equality check to skip no-op updates). Also move the `shouldAutoScroll` guard from outside the scroll dispatch to inside it, so the flag is consulted at scroll time — after the synchronous observer update has landed — rather than snapshotted earlier.
3. **Let scrollbar clicks through.** Add a `hitTest(_:)` override on `DragView` that returns `nil` when the pointer is over the visible vertical scroller (`!isHidden` and `alphaValue > 0.01`). AppKit then hit-tests past the overlay to the scroller, which handles the click natively. Everything else still falls through to `mouseDown` → `performDrag`.

## Key Files

- `Sources/RecordingView.swift`
  - `ScrollPositionObserver.Coordinator.attemptSetup` — retry logic for observer attachment
  - `ScrollPositionObserver.Coordinator.scrollViewDidScroll` — synchronous `isAtBottom` update
  - `RecordingView.deferredScrollToBottom` — guard moved inside the dispatch
  - `WindowDragOverlay.DragView.hitTest` — new override letting scrollbar clicks through

## Lessons Learned

- **`NSViewRepresentable` setup that depends on sibling AppKit views must retry.** `viewDidMoveToWindow` and a one-shot async dispatch aren't enough when the target view is created by a separate SwiftUI-managed layout pass (here, the List's backing NSTableView). Silent setup failures are especially nasty because they default-fail-open — the feature compiles, launches, and "works" enough to hide the bug in casual testing.
- **Don't cache state that's being concurrently updated via `main.async`.** If an observer posts flag changes via async dispatch, any consumer that reads the flag before that dispatch runs will see stale data. Either update synchronously (and re-check at the point of action), or consult the source of truth directly (e.g., query the NSScrollView's offset at scroll-decision time).
- **Window-drag overlays must be scrollbar-aware.** `window.isMovableByWindowBackground` is the simple route; when an explicit overlay is needed, `hitTest` — not `mouseDown` — is the right place to carve out interactive subregions like scrollers, buttons, and text selection handles. An override in `mouseDown` has already stolen the event.
