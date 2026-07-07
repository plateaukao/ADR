2026-07-07

# NerLan: now-playing info pushed on state changes, not every tick

## What was broken

`PlayerManager`'s 0.5s periodic time observer called `updateNowPlayingElapsed()` on every tick — rebuilding the now-playing dictionary and pushing it to `MPNowPlayingInfoCenter` (an XPC hop to the media server) twice a second for the whole duration of playback.

That's unnecessary by design: iOS extrapolates the lock-screen elapsed time from the *last* `MPNowPlayingInfoPropertyElapsedPlaybackTime` plus `MPNowPlayingInfoPropertyPlaybackRate`. Apps are expected to push only when the state actually changes.

## Fix

All state transitions already pushed explicitly — `play()`/`pause()`, `seek(to:)`, the `playbackRate` didSet, and `load()` (track change). The per-tick push is gone; the tick now pushes exactly once when the item's duration first becomes known (AVPlayer reports it asynchronously after load), so the lock-screen scrubber still gets its track length. As a side effect `clock.duration` also stops re-publishing an unchanged value on every tick.
