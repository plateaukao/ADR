# Fix: TTS Screen Power Cycling on E-ink Devices

## Problem
When starting TTS audio playback (ETTS type), the E-ink device screen would briefly turn off and immediately back on.

## Root Cause
`TtsNotificationManager` was posting a media-style notification and activating `MediaSessionCompat` during the PREPARING state, before audio actually started. This caused multiple rapid notification posts and MediaSession state transitions (BUFFERING x2 then PLAYING) before `MediaPlayer.start()` was called. On E-ink devices, this premature MediaSession activation triggered a display power cycle.

## Solution
Skip notification posting and MediaSession activation during `TtsReadingState.PREPARING`. The notification now only appears when transitioning to PLAYING, when audio actually starts.

## Key Files
- `app/src/main/java/info/plateaukao/einkbro/service/TtsNotificationManager.kt` - added early return for PREPARING state

## Lessons Learned
- On E-ink devices, `MediaSessionCompat` activation can trigger hardware-level display power cycling, not just visual refreshes.
- `FLAG_KEEP_SCREEN_ON` was insufficient - the root cause was premature MediaSession activation, not screen timeout.
- Delaying system-level media signals until audio actually plays avoids triggering device power management prematurely.
