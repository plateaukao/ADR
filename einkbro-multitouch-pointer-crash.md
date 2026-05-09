# einkbro: pointerIndex out-of-range crash in multitouch swipe handler

## Problem

Two crash reports were captured on the emulator within ~1 minute of each
other, both surfacing the same fatal exception inside `info.plateaukao.einkbro`:

```
java.lang.IllegalArgumentException: pointerIndex out of range
    at android.view.MotionEvent.nativeGetAxisValue(Native Method)
    at android.view.MotionEvent.getX(MotionEvent.java:2453)
    at n3.F.c(SourceFile:3)
    at n3.F.onTouch(SourceFile:712)
    at android.view.View.dispatchTouchEvent(View.java:14638)
    ...
```

The crash always originated from a custom `View.OnTouchListener` calling
`MotionEvent.getX(index)` with an invalid pointer index.

## Root Cause

`MultitouchListener` tracks two-finger swipes using an `inSwipe` flag plus
captured `startPoint0/1` and `endPoint0/1`. The flag is only cleared in two
places:

- `ACTION_POINTER_UP` (when the second finger lifts mid-gesture).
- `onStop` lifecycle callback (when the activity goes to background).

Two failure modes followed from this:

1. The early-return gate
   `if (!inSwipe && event.pointerCount != touchCount) return ...`
   short-circuits the second `when` block only when `inSwipe == false`.
   Once `inSwipe` is set true, *every* subsequent event reaches the inner
   `when`, regardless of how many pointers are actually present.
2. The `ACTION_MOVE` arm unconditionally read pointer index 1 via
   `event.getPoint(1)` whenever `inSwipe` was true.

If `inSwipe` got stuck (no `ACTION_POINTER_UP` ever arrived because the
gesture was cancelled by the system, parent-intercept, or any non-standard
event sequence), the very next single-finger `ACTION_MOVE` reached the inner
`when` and crashed on `getX(1)` because only one pointer was active.

`ACTION_UP` and `ACTION_CANCEL` were never used to clear `inSwipe`.

## Solution

Two minimal guards in `MultitouchListener.onTouch`:

1. Defensive check on the `ACTION_MOVE` arm: only access pointer index 1
   when at least two pointers are present.
   ```kotlin
   MotionEvent.ACTION_MOVE -> {
       if (inSwipe && event.pointerCount >= 2) {
           endPoint0 = event.getPoint(0)
           endPoint1 = event.getPoint(1)
           ...
       }
   }
   ```
2. Clear `inSwipe` on terminal touch events that previously did not reset
   it:
   ```kotlin
   MotionEvent.ACTION_UP,
   MotionEvent.ACTION_CANCEL -> inSwipe = false
   ```

A first attempt also added an `event.pointerCount < 2` guard inside the
`ACTION_POINTER_DOWN` arm. Code review identified that as dead code:
`ACTION_POINTER_DOWN` is, by Android's multi-touch contract, only dispatched
when a non-primary pointer goes down, so `pointerCount` is always ≥ 2 in
that branch. The guard was removed.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/view/MultitouchListener.kt` —
  the only file changed. Contains both the buggy state machine and the fix.

## Lessons Learned

- An `inSwipe` flag (or any boolean tracking the start of a multi-pointer
  gesture) must be reset on every terminal touch action — `ACTION_UP`,
  `ACTION_CANCEL`, `ACTION_POINTER_UP` — not just the one path the code
  expects to see. `ACTION_CANCEL` in particular is silent and easy to forget.
- Once a stateful gate is set true, defensive checks on later branches
  cannot rely on the early-return pattern at the top of the handler;
  guards must hold under a stuck-flag scenario.
- Only call `MotionEvent.getX(index)` / `getY(index)` after verifying
  `pointerCount` is large enough for the index. The crash from indexing into
  a no-longer-active pointer is a `IllegalArgumentException`, not a graceful
  return.
- Defense-in-depth checks at unreachable code paths add noise and can
  mislead future readers; preferring tight, reachable guards over scattered
  ones is worth the few extra seconds at review.
