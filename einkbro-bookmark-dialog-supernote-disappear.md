<!-- added: 2026-05-10 -->
# Bookmark Dialog Disappears on Supernote When Entering a Folder

## Problem
On Supernote (e-ink) devices, opening the bookmarks dialog and tapping a folder icon to drill into it caused the dialog to vanish entirely instead of showing the folder's contents. The dialog never came back. On faster phones the same flow worked, so the regression went unnoticed for a while.

## Root Cause
A previous change (commit `cce83fa6`, "remove animation when switching view mode or navigating folders in bookmark dialog") added an alpha-flip trick in `BookmarksDialogFragment` to hide the brief window-resize jump that occurs when folder content of a different size loads. Two paths set the dialog window's `alpha = 0`:

1. An `OnLayoutChangeListener` on `composeView` that fired on every dimension change.
2. The directory branch of `onBookmarkClick` (the explicit folder-tap path).

Both then scheduled `composeView.postDelayed(showRunnable, 300)` — where `showRunnable` set `alpha = 1` — and *each subsequent layout change called `removeCallbacks(showRunnable)` and rescheduled it for another 300 ms*.

Tapping a folder triggers an asynchronous chain on Supernote:
- `bookmarkViewModel.intoFolder(it)` updates the ViewModel
- the bookmarks `Flow` re-emits with the folder's items
- `key(currentFolder.id, isGridView)` forces a full grid teardown + rebuild
- Compose runs multiple measure / layout passes as items resolve

On Supernote's slower CPU and e-ink refresh, those layout passes are spaced widely. Each pass cancelled the pending `showRunnable` and posted a new 300 ms timer. If layout did not quiet down within a single 300 ms window, the show callback never fired and the window stayed at `alpha = 0` indefinitely. From the user's perspective, the dialog "disappeared." Faster hardware happened to win the timing race.

```mermaid
sequenceDiagram
    participant U as User
    participant F as Fragment
    participant L as LayoutListener
    participant V as composeView (Handler)
    U->>F: tap folder icon
    F->>F: alpha = 0, post showRunnable in 300ms
    F->>F: intoFolder(folder)
    Note over F: ViewModel emits new items<br/>key() rebuilds grid
    L->>V: layout change #1 → cancel + reschedule (300ms)
    L->>V: layout change #2 (>300ms gap on e-ink) → cancel + reschedule
    L->>V: layout change #3 → cancel + reschedule
    Note over V: showRunnable never fires; alpha stays 0
```

## Solution
Drop the alpha-masking entirely. The `key()`-driven grid recreation and `windowAnimations = 0` from the same earlier commit already suppress the animation that mattered (item transitions and the dialog open/close style). The only thing lost is masking a brief window-height resize on folder navigation — a minor visual blip and barely visible on e-ink anyway. The lost masking is a much smaller regression than a permanently invisible dialog.

Specifically, in `BookmarksDialogFragment.kt`:
- Removed the `showRunnable` field.
- Removed the `composeView.addOnLayoutChangeListener { ... }` block.
- Removed the alpha=0 + `postDelayed(showRunnable, 300)` lines from the directory branch of `onBookmarkClick`; that branch now just calls `bookmarkViewModel.intoFolder(it)`.

## Key Files
- `app/src/main/java/info/plateaukao/einkbro/view/dialog/compose/BookmarksDialogFragment.kt`

## Lessons Learned
- `removeCallbacks` + `postDelayed` to "wait for layout to settle" is a fragile pattern: any sustained stream of layout events shorter than the delay starves the trailing callback. On slow hardware the opposite happens — gaps between layout events exceed the delay and the callback fires too early. There is no single delay that is safe for both.
- An alpha-flip on a window is invisible to the harness when it never flips back. If you must do this, schedule a fail-safe alpha=1 on `onResume` (or via a max-wait timeout) so a missed flip can't permanently hide UI.
- E-ink hardware exposes timing-race bugs that pass silently on phones. Worth re-testing animation/refresh tweaks on Supernote before assuming they are safe.
