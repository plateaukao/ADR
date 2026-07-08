2026-07-08

# WhisperASR: stop deleting imported audio when removing a transcription

Removing a transcription from the sidebar called `FileManager.removeItem(at: item.fileURL)` — a permanent delete of whatever audio file the item pointed at. For recordings the app made itself that was arguably fine, but for files the user drag-dropped or picked from disk (a lecture recording on the Desktop, a podcast in Downloads) it silently destroyed the user's original file. The confirmation dialog only said the item "will be removed", never that the source audio would be deleted from disk.

The fix draws an ownership line:

- `TranscriptionStore.isAppRecording(_:)` checks whether the audio lives inside the app's own `~/Library/Application Support/WhisperASR/Recordings/` folder.
- Only app-owned recordings are disposed of on removal — and via `FileManager.trashItem`, so even those are recoverable from the Trash rather than gone.
- Imported files are left untouched; only the transcription JSON is deleted.
- The confirmation dialog now states which of the two will happen for the specific item ("…moved to the Trash" vs "…the original audio file stays on disk").

The path check uses `standardizedFileURL` on both sides with a trailing-slash prefix match, so symlinked App Support paths and lookalike directory names (`Recordings-old`) don't misclassify.
