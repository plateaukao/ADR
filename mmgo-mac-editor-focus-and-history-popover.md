# mmgo-mac: Fix unfocusable editor in NavigationSplitView sidebar; rework history as a popover

## Problem
After switching to `NavigationSplitView` (commit 563dc81), the Mermaid source editor — an `NSTextView`-backed `NSViewRepresentable` living in the sidebar column — would render correctly but refuse to take first responder. Clicking the text view did nothing; the caret never appeared; typing went nowhere. Separately, the existing history `Menu` was a flat list with no per-item deletion and no way to scroll long histories. And launching the app via `swift run` did not reliably bring the window forward / make it key.

## Root Cause
Three independent issues that compounded into "the app feels broken":

1. **First-responder hand-off in NavigationSplitView's sidebar column is fragile.** SwiftUI's default click → first-responder routing didn't reach the embedded `NSTextView`. The view received `mouseDown` events but the window never asked it to become first responder.
2. **`updateNSView` clobbered in-progress edits.** The original `if tv.string != text` sync ran whenever SwiftUI re-evaluated the parent — including while the user was typing. That was masked when focus didn't work; once focus was fixed it would have produced visible glitches.
3. **`swift run` produces a CLI-style executable, not a `.app` bundle.** Without an explicit `NSApp.setActivationPolicy(.regular)` + `activate(ignoringOtherApps:)`, the process can sit behind other windows or fail to receive key events at launch.

## Solution
One coordinated change across three files:

1. **`MermaidEditor.swift`** — replaced `NSTextView.scrollableTextView()` with a hand-assembled `NSScrollView` + `MermaidTextView` (a small `NSTextView` subclass). `MermaidTextView` overrides `mouseDown` to forcibly call `window.makeFirstResponder(self)` whenever the window's current first responder isn't us, and `viewDidMoveToWindow` to claim focus on first attach. `updateNSView` now skips the `tv.string = text` sync when the text view holds first responder, so user typing is never overwritten — and the `Coordinator.parent` field changed from `let` to `var` so it tracks the latest SwiftUI state.

2. **`ContentView.swift`** — replaced the `Menu`-based history with a `popover(isPresented:)` that hosts a scrollable `LazyVStack` with per-item delete buttons (`xmark.circle.fill`) and a "Clear history" footer. Added `blurEditor()` (which calls `NSApp.keyWindow?.makeFirstResponder(nil)`) and invoked it from `pasteFromClipboard()` and `selectHistoryItem(_:)` before mutating `source` — this is the counterpart to the "skip sync while focused" guard in step 1, ensuring external setters still reach the text view.

3. **`MmgoMacApp.swift`** — wired up `@NSApplicationDelegateAdaptor(AppDelegate.self)`. The `AppDelegate.applicationDidFinishLaunching` sets activation policy to `.regular`, activates the app, and calls `makeKeyAndOrderFront` on the first window.

## Key Files
- `Sources/MmgoMac/MermaidEditor.swift` — `MermaidTextView` subclass; updated `makeNSView`/`updateNSView`.
- `Sources/MmgoMac/ContentView.swift` — `historyPopover`, `blurEditor()`, `selectHistoryItem`, `removeHistoryItem`.
- `Sources/MmgoMac/MmgoMacApp.swift` — `AppDelegate` activation handling.

## Lessons Learned
- **`NavigationSplitView`'s sidebar column doesn't reliably hand off first responder to `NSViewRepresentable` content.** Overriding `mouseDown` + `viewDidMoveToWindow` to claim focus directly is the most reliable fix; relying on the framework's default routing is not enough.
- **An `NSViewRepresentable` whose state is also externally mutated needs two-way write protection.** `updateNSView` must not stomp on the AppKit view's authoritative state while the user is editing. The cleanest discriminator is "is this view first responder?" — and external setters (paste, history selection) then have to blur first.
- **`@State` references inside a `Coordinator` go stale unless `parent` is updated.** Using `let parent` is a common SwiftUI footgun; changing to `var parent` and refreshing it in `updateNSView` keeps closures and callbacks bound to current state.
- **`swift run` of a SwiftUI app is not a real app bundle.** Without `setActivationPolicy(.regular)` + `activate(ignoringOtherApps:)`, key-event delivery and Dock behavior are unpredictable. An `NSApplicationDelegateAdaptor` is the smallest way to fix this without leaving SwiftUI.
- **`Menu` is the wrong primitive for a history list with delete affordances.** macOS menus don't scroll well and have no idiomatic per-row controls; a `popover` with a `LazyVStack` is much closer to what users actually want.
