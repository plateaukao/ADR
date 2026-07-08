2026-07-08

# WhisperASR: clean up the writer and stray file when recording fails to start

`AudioRecorder.startRecording()` builds its session in stages: create and start an `AVAssetWriter` (which creates the output `.m4a` on disk), stash the writer/input/URL in properties, then construct the `SCStream` and `try await startCapture()`. If a late stage threw — screen-capture permission revoked mid-flow, stream configuration rejected — the `catch` block only set an error message. The consequences accumulated silently:

- the started writer was never finished or cancelled (leaked, with its file handle),
- an empty `.m4a` stayed behind in the Recordings folder forever,
- the stale `assetWriter` / `assetWriterInput` / `outputURL` references stuck around until the next attempt overwrote them.

The failure path now tears down in reverse order: stop any half-started stream, `cancelWriting()` on the writer, delete the stray output file, and clear all recording references — so a failed start leaves the recorder in the same state as before the attempt, and the next attempt begins from a clean slate.
