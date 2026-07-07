2026-07-07

# EinkBro: five small UI correctness fixes from the Compose audit

A full UI audit surfaced a batch of small, independent correctness bugs.
They shipped as one commit since each fix is a few lines; this ADR records
what was broken and why.

## 1. Crash on non-numeric input in Int settings

`ValueSettingItemUi` did an unguarded `value.toInt()` when the backing
config value was an `Int`. Typing "abc" into "Padding for reader mode"
threw `NumberFormatException` and crashed the settings activity. Now
`toIntOrNull() ?: return@launch` — invalid input is simply ignored — and
the local display state is updated with the parsed `Int` rather than the
raw `String` masquerading as `T`.

## 2. URL bar could double-submit on hardware Enter

The `onKeyEvent` handler contained a dangling `true` expression, so the
lambda **always returned false**: Enter was never consumed, the branch
matched both KeyDown and KeyUp, and the same field also declared
`keyboardActions.onSearch` — which Compose maps hardware Enter to on
single-line fields. One press could invoke `onValueSubmit` (and load the
page) twice: a double full-screen flash on e-ink, where many devices ship
hardware keyboards or page-turn remotes. The handler now submits once on
KeyUp and consumes both key events so the IME action path cannot fire for
the same press.

## 3. Font boldness slider persisted a stale value

`onValueChange` read `progressValue`, which was computed from
`sliderPosition` during the *previous* composition, so every change —
including the final one of a drag — reported one step behind the thumb.
Now the callback derives the value from the fresh slider position
(`values[it.toInt()]`).

## 4. Saved landscape FAB position silently wiped

`positionValidation()` checked `orientation != ORIENTATION_LANDSCAPE`
where it meant `==`: the landscape position was validated against
*portrait* parent dimensions. Any legitimate landscape x (larger than the
portrait width, which is typical) reset the saved point to (0,0) every
time the FAB was shown or dragged in portrait — and the position was never
validated in actual landscape.

## 5. Drag handles: broken grab offset + a prefs write per touch move

The touch-area drag declared `var dY = 0F` *inside* `customOnTouch`, so
the offset captured on ACTION_DOWN was discarded and every MOVE computed
with zero — the handle snapped under the finger, with a bogus
toolbar-height correction compensating for the wrong coordinate space.
The offset is now a field; since `view.y - event.rawY` bakes in both the
grab point and the parent's constant screen offset, the toolbar
correction could be dropped entirely.

Both the touch-area and FAB drags also wrote SharedPreferences on **every
ACTION_MOVE** — each write dispatching to every registered preference
listener, including BrowserActivity's 40-key `when` block, per touch
event. Both now only move views during the drag and persist once on
ACTION_UP.

## Verification

Emulator, debug build: typing "abc" into "Padding for reader mode" and
pressing OK no longer crashes (previously a guaranteed crash); hardware
Enter in the URL bar submits and loads exactly one page; touch-area
toggling works; app process stable throughout. The boldness and FAB
orientation fixes are one-line logic corrections verified by inspection.
