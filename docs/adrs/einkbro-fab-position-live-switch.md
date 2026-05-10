# einkbro: switch FAB position live without activity restart

## Problem

Changing the "Floating Button position" preference (Left / Right / Center / Custom / NotShow) triggered `config.restartChanged = true`, which prompted the user with a restart-confirm dialog. The premise of the task was to consolidate "three floating buttons" into one moved by `ConstraintLayout` — turned out only one FAB existed already, so the real win was making position changes apply live.

## Root Cause

Two layered issues:

1. **Restart trigger.** `BrowserActivity.kt:1053` mapped `K_NAV_POSITION` changes to `config.restartChanged = true` instead of re-laying out the FAB.
2. **Stale translation after going live.** Once the position-update path was made live, the existing `textView.x = 0f; textView.y = 0f` reset in `FabImageViewController.initialize()` started misbehaving. `View.setX()` is implemented as `setTranslationX(x - mLeft)`. On first activity startup `mLeft` was 0, so `setX(0)` was a no-op. But on a live preference change, the FAB had already been laid out with a non-zero `mLeft/mTop`, so `setX(0)` left a *negative* `translationX/Y` behind. After `applyTo()` re-ran layout, the translation persisted — visually pulling the FAB off its anchor (most visibly on the Y axis) even though `dumpsys` reported correct layout bounds.

## Solution

In `FabImageViewController`:
- Extract `applyFabPosition(animate)` that clones the parent `ConstraintSet`, clears the FAB's four sides, reconnects only those needed for the new `FabPosition`, and `applyTo(parent)` (optionally wrapped in `TransitionManager.beginDelayedTransition`).
- `initialize()` now just delegates to `applyFabPosition(animate=false)`.
- Replace `textView.x = 0f / textView.y = 0f` with `textView.translationX = 0f / translationY = 0f` so we clear translation directly instead of computing a translation relative to the current laid-out position.

In `BrowserActivity`:
- `K_NAV_POSITION -> fabImageViewController.applyFabPosition()` instead of triggering the restart-confirm dialog.

Visibility is intentionally left to `FullscreenDelegate` (FAB is the inverse of the toolbar) — `applyFabPosition` only flips visibility for the `NotShow` case.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/view/viewControllers/FabImageViewController.kt`
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt`

## Lessons Learned

- `View.setX()` / `setY()` are not "absolute coordinate" setters; they are translation setters relative to the current laid-out position. To clear positioning side effects, use `translationX/Y = 0f` directly. This bug is invisible in code paths that only run before the first layout (e.g. activity init), and only surfaces once you start invoking that code on an already-laid-out view.
- `dumpsys activity top` shows layout bounds (`mLeft/mTop/mRight/mBottom`) — it does not reflect `translationX/Y`. A FAB visibly in the wrong place can still report "correct" bounds, which made the bug look phantom on first inspection.
- When a "phantom" tap test seems to confirm a bug, verify the preference actually changed (no log emitted = listener never fired = nothing to validate). The first reproduction attempt here was a missed tap, not a real bug.
- Replacing `textView.layoutParams = ...` reassignment with `ConstraintSet.clone + clear + connect + applyTo` on the parent is the idiomatic way to make a position swap live and animatable.
