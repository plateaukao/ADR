2026-07-07

# NerLan: play on a finished episode restarts it

## What was broken

When the last episode in the queue played to the end, `playbackDidFinish → next()` set `isPlaying = false` and left the `AVPlayer` parked at the item's end. Tapping play (mini player, full player, or lock screen) then called `player.play()` at end-of-item: AVPlayer produces no audio there, but the app flipped its state to "playing" — a play button that does nothing except lie about the state, with a stuck progress clock.

## Fix

`play()` (the shared resume path introduced with the remote-command fix) checks whether the position is at — or within half a second of — the known duration, and seeks to 0 before playing. Half a second matches the periodic time observer's tick granularity, so a clock that stopped one tick short of the exact end still counts as "at the end".
