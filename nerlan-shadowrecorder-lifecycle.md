2026-07-07

# NerLan: ShadowRecorder lifecycle fixes (failed start, dropped delegate)

## What was broken

Two related lifecycle bugs in the shadowing voice recorder:

1. **`record()`'s result was ignored.** `AVAudioRecorder.record()` returns `false` when the hardware can't start (mic held by another process, session misconfigured). The code set `isRecording = true` regardless, leaving the UI showing a live recording — and `PlayerManager` stuck in the play-and-record session — with nothing actually recording.
2. **The recorder was released before its delegate fired.** `stopRecording` called `recorder?.stop()` and immediately `recorder = nil`. `stop()` finalizes the file *asynchronously* and reports completion via `audioRecorderDidFinishRecording` — which consumes `autoPlayURL` to play the take back (the record-then-hear-yourself flow). If the recorder deallocated before delivering the callback, the auto-play silently never happened.

## Fix

- A failed `record()` now unwinds: drop the recorder, hand the audio session back to `PlayerManager`, return `false` so the caller shows the mic alert.
- `stopRecording` keeps the reference; `audioRecorderDidFinishRecording` releases it with an `===` identity check, so a rapid "stop, then immediately start the next take" can't have the old take's late callback drop the new recorder mid-recording.
