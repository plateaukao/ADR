2026-07-08

# WhisperASR: small cleanups — dead liveText, export names, status check

Three tiny leftovers swept up in one commit during the same audit that produced the day's bug-fix batch:

- **Dead state**: `AppState.liveText` was assigned (cleared) in two places and read nowhere — the recording window renders `liveSegments` directly, and `finishRecording` recomputes the joined text from the segments it captures. Removed.
- **Export filenames**: "Export Text…" derived its default filename with `replacingOccurrences(of: ".m4a", with: ".txt")`, which rewrites *every* occurrence of the extension substring anywhere in the name (`meeting.m4a.backup.m4a` → `meeting.txt.backup.txt`). Both export paths now use `deletingPathExtension` + the new suffix.
- **Redundant condition**: the sidebar context menu guarded Re-transcribe with `status == .completed || status != .transcribing`, where the first clause is subsumed by the second. Reduced to `status != .transcribing`.
