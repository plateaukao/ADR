2026-07-07

# NerLan: double-starting the shadow recorder leaked a live microphone

## What was broken

`ShadowRecorder.startRecording` built a fresh `MediaRecorder` and assigned it to
the `recorder` field without checking whether one was already running. Two paths
could start twice:

- A fast double tap on the 錄音 button — its `onClick` branches on the Compose
  snapshot of `isRecording`, which lags the StateFlow by a frame, so both taps
  can take the "start" branch.
- The finite-loop auto-record (`loopFinishedSignal` → `requestRecord`) racing a
  manual tap.

The overwritten recorder was orphaned mid-recording: never stopped, never
released, holding the microphone and its native codec resources until process
death — and `target.delete()` at the top of the second start unlinked the file
the orphan was still writing.

## Fix

`startRecording` now begins with `if (recorder != null) stopRecording(thenPlay =
false)`, which stops and releases the live recorder (discarding a too-short take
safely — `stop()` failures are already handled) before creating the new one.

## Verification

On the emulator (mic granted): record → stop → the take saved and 播放我的錄音
enabled, auto-playback ran — the normal flow is intact with the guard in place.
The double-start window itself is a few milliseconds wide and not reliably
reachable by injected taps; the guard covers it by construction — any live
recorder is stopped and released before a new one exists.

Commit: `16a777e` in nerlan-android.
