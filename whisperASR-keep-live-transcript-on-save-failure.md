2026-07-08

# WhisperASR: keep the live transcript when the recording file fails to save

Finishing a recording ran this sequence: capture the live segments into locals, call `stopLiveTranscription()` — which clears all live state **and deletes the crash-recovery file** — then `await recorder.stopRecording()` to finalize the m4a. If the asset writer failed (no samples received, writer error), `stopRecording()` returned `nil` and the code simply added nothing. The captured transcript was still sitting in local variables, but it was never used: an hour of live transcription could vanish because the *audio* file didn't save, even though the recovery file had been faithfully protecting exactly that transcript until moments earlier.

The root cause was ordering — the recovery file was destroyed before knowing whether the recording survived — plus a missing branch for "no audio, but we have a transcript".

The finish flow also existed twice, copy-pasted: once in `RecordingView.stopAndDismiss()` (the Finish Recording button) and once in `SidebarView.handleMeetingEnded()` (the Zoom meeting-ended alert). Both copies were replaced by a single `AppState.finishRecording(recorder:)` method that:

1. Captures live segments/translations before stopping anything.
2. Stops live transcription, then the recorder.
3. Files the result: with a saved audio file, exactly as before; with `url == nil` but a non-empty live transcript, as an audio-less item named "Recording {date} (audio not saved)" — mirroring how crash-recovered transcripts are already imported.

`addFileWithLiveResults` now returns the created item (`@discardableResult`) so the fallback branch can rename it after creation.
