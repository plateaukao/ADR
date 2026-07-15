2026-07-07

# NerLan: speech transcoder cleans up its temp files on failure

## What was broken

`SpeechAudioExporter.exportChunks` transcodes an episode into about 20-minute mono AAC chunks in the temp directory. Two leak paths:

1. If transcoding chunk N threw, chunks 1…N-1 were already written but their URLs vanished — `exportChunks` swallows the error into the `[sourceURL]` fallback, so the caller's normal `cleanupChunks` never sees them. At about 5 MB per chunk, retries against a flaky source piled files up until the OS purged temp.
2. `transcode` itself could throw after `AVAssetWriter` had created its output file (failed `startWriting`, writer ending in `.failed`), leaving a partial `.m4a` behind.

## Fix

- The chunk loop catches, deletes every already-produced chunk, and rethrows — the fallback path now starts clean.
- `transcode` routes all post-writer-creation failures through a `fail()` helper that removes the output file before returning the error.
