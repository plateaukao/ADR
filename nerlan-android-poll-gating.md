2026-07-08

# NerLan: the player's poll loops now sleep when nothing plays

## What was wasted

Two poll loops ran regardless of playback state:

- The 500 ms position/stats loop was a `while (true)` launched at initialize and
  never paused — the main thread woke twice a second for the process's entire
  lifetime, even paused in the background for hours.
- The 40 ms sentence-loop poll (shadowing) kept spinning while playback was
  paused — 25 wakes/second that could never fire, since a paused position can't
  cross the loop boundary.

## Fix

- The stats loop sleeps on `_isPlaying.first { it }` when not playing; the
  controller listener flipping `isPlaying` wakes it. Because the ticker no
  longer runs while paused, seeks made while paused publish their position
  directly: `seekTo`/`skip` set `_positionMs`, and `onIsPlayingChanged` snaps
  position/duration on both edges.
- The loop poll checks `isPlaying` and idles at 250 ms while paused (after the
  media-id staleness check, which stays prompt), resuming 40 ms polling with
  playback.

## Verification

On the emulator: time labels tick while playing (0:02 → 0:04); pausing freezes
them; tap-to-seek **while paused** updates the label immediately to 2:29 (the
direct-publish path); resuming ticks on from 2:32. With a sentence loop armed:
pause froze playback, resume continued, and the loop still bounced cleanly
(0 → 9.1 s → 0 on a [0, 10 s) region).

Commit: `f9ec4c6` in nerlan-android.
