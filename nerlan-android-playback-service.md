2026-07-08

# NerLan: wake lock for screen-off streaming; media notification opens the app

## What was broken

Two gaps in `PlaybackService`:

- `ExoPlayer.Builder` defaulted to `WAKE_MODE_NONE`: no wake or wifi lock during
  playback. Streaming (not downloaded) audio with the screen off could stall
  mid-episode once the buffered range drained and the device entered doze with
  the radio idle. The manifest declared `WAKE_LOCK` but nothing ever used it.
- `MediaSession.Builder(...).build()` set no session activity, so the media
  notification and lock-screen card had no content intent — tapping them did
  nothing, and the only way back into the player UI was the launcher.

## Fix

- `.setWakeMode(C.WAKE_MODE_NETWORK)` — the right mode for streamed audio
  (wake + wifi lock, held only while playing); harmless for local files.
- `.setSessionActivity(PendingIntent.getActivity(launchIntent))` so the
  notification opens the app.

## Verification

On the emulator: streaming a non-downloaded episode, `dumpsys power` shows
`PARTIAL_WAKE_LOCK 'ExoPlayer:WakeLockManager'` held by the app's uid (and
released when playback stopped earlier in the log). With the app backgrounded,
tapping the shade's media card brought `com.danielkao.nerlan` to the
foreground.

Commit: `35c7fc9` in nerlan-android.
