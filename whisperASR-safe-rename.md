2026-07-08

# WhisperASR: don't break the audio link when renaming a file fails

`AppState.renameItem()` renamed the audio file on disk with `try? FileManager.moveItem(...)` — swallowing any failure — and then unconditionally updated `item.fileURL` and `item.fileName` to the new name, persisting them. If the move failed, the item now pointed at a file that doesn't exist: playback went silent, re-transcription failed, and removal couldn't find the file. The easiest way to hit it was a name collision — `moveItem` throws when the destination already exists — but a locked file or missing source did the same.

The fix makes the URL update conditional on the move actually succeeding:

- The move runs in a real `do/catch`; on failure the user gets a toast with the underlying error and the item is left exactly as it was.
- `item.fileURL` is only reassigned after a successful move.
- Items whose audio file no longer exists on disk (e.g. crash-recovered transcripts with synthetic paths) skip the move entirely and just update their display name — previously the `try?` happened to make this "work" by accident; now it's an explicit case.
