2026-07-27

# sim-use: multi-touch and two-finger tap on real iOS devices

Follow-up to the gesture-preset ADR ([sim-use-ios-device-gesture-presets](sim-use-ios-device-gesture-presets.md)):
with `GesturePresetStrokeEncoder` and the typed `gesture(strokes:)` client
call in place, the raw two-finger verbs cost almost nothing to add. This
change wires three surfaces to the device bridge's `/gesture` endpoint:

- `sim-use ios-device multi-touch` / top-level `sim-use multi-touch` — two
  parallel linear strokes with explicit start/end per finger, mirroring the
  Android verb's flag surface (`--x1/--y1/--x2/--y2/--*-end`, `--duration`).
- `tap --fingers 2` and `long-press --fingers 2` — a shared
  `performTwoFingerHold` builds two `start == end` strokes with a real hold
  duration, the same pattern every backend uses to make recognisers see a
  hold rather than a sub-millisecond contact.

The interesting part is what was *fixed* rather than added: the top-level
`tap` / `long-press` device paths accepted `--fingers 2` and **silently
ignored it**, dispatching a one-finger tap. Silent flag-dropping is worse
than refusing — an agent reading "✓ Tap completed" has no way to know the
gesture it asked for never happened.

As on Android, `--steps` / `--step-ms` are Simulator-HID-specific and
ignored — the bridge interpolates each stroke at 60 Hz on-device. There is
no display-bounds pre-flight (iOS clamps silently; Android keeps its
pre-flight because its framework rejects out-of-bounds paths opaquely).

## A verification gotcha: the stale daemon

The first live run of the new verb failed with the *old* "not wired up yet"
error — because `sim-use` forwards UDID-scoped verbs to a per-UDID daemon,
and the daemon was still the process spawned by the previous build. The new
CLI faithfully forwarded to old code. `sim-use daemon stop --device <udid>`
before re-testing is the rule; worth remembering for any sim-use dev loop
that iterates on verb behaviour.

## Live verification (iPhone 17 Pro, iOS 27, Apple Maps)

| Check | Signal |
|---|---|
| `multi-touch` vertical spread (fingers apart) | Map zoomed in until the visible POI label set emptied |
| `tap --fingers 2` ×4 (Maps' zoom-out gesture) | POI labels reappeared (0 → 10 visible point features) |

`long-press --fingers 2` shares `performTwoFingerHold` with the verified
two-finger tap — same code path, different hold duration — so it was not
separately device-tested.
