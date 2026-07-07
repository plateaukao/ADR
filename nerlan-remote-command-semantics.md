2026-07-07

# NerLan: remote play/pause get explicit semantics; headset taps handled

## What was broken

Two related gaps in the `MPRemoteCommandCenter` wiring:

1. `playCommand` and `pauseCommand` both called `togglePlayPause()`. In the common lock-screen flow that works (iOS shows the button matching the current state), but sources that send *semantic* commands — CarPlay, watchOS, or a Control Center whose state got out of sync — could send "play" while the app was already playing. The toggle then paused, which is the opposite of the request and makes any state desync self-perpetuating.
2. `togglePlayPauseCommand` — the command AirPods/headset taps actually send — had no registered handler, so those taps did nothing.

## Fix

`togglePlayPause()` is now composed of two explicit halves — the pre-existing `pause()` (guards on playing, flushes listening stats) and a new symmetric `play()` (guards on paused, restarts the listening tick). The remote commands map one-to-one:

- `playCommand` → `play()`
- `pauseCommand` → `pause()`
- `togglePlayPauseCommand` → `togglePlayPause()`

A side benefit: `play()` no-ops when no item is loaded, so the old toggle's quirk of flipping `isPlaying` to true with an empty player is gone.
