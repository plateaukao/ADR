2026-07-08

# WhisperASR: allow seeking before the audio duration has loaded

Tapping a transcript segment right after selecting an item played from 0:00 instead of the segment. `AudioPlayerManager.seek(to:)` clamped the target time to `min(time, duration)`, but `duration` starts at 0 and is only filled in by an async `asset.load(.duration)` after `load(url:)` returns. In the window before that completes (or if metadata loading fails outright), every seek was clamped to `min(time, 0)` = 0 — the tap-to-play-from-here gesture silently degraded to play-from-start.

The fix skips the upper clamp while the duration is unknown: `duration > 0 ? max(0, min(time, duration)) : max(0, time)`. This is safe because `AVPlayer.seek` clamps out-of-range times to the item's actual duration itself — the local clamp only exists to keep the published `currentTime` (slider position) tidy, and once the duration is known the original behavior is unchanged.
