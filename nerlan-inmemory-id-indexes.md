2026-07-07

# NerLan: list rows stop stat-ing the filesystem on every render

## What was broken

Three hot predicates were filesystem probes, called from row `body`s while scrolling:

- `DownloadManager.isDownloaded(episodeId:)` probed up to **7 candidate paths** (`.mp3`, `.m4a`, `.aac`, …) with `FileManager.fileExists` per call.
- `AIContentStore.hasTranscript/hasHandout` were each one `fileExists` per call.
- `AIContentStore.aiRecords` filtered every known record through both predicates — and `AITabView` evaluates `aiRecords` three times per body (empty-check, list, overlay-check).

Multiply by rows on screen × every re-render (any store publish during scrolling) and the main thread spends its frame budget asking the filesystem questions whose answers almost never change.

## Fix

Each store keeps an `@Published` id set mirroring its directory, making the predicates O(1) set lookups:

- `DownloadManager.downloadedIds` — seeded by one `audioDir` scan at init; `insert` when a finished download is moved into place, `remove` on delete.
- `AIContentStore.transcriptIds` / `handoutIds` — seeded at init (after the malformed-content cleanup so junk files don't enter the set); `insert` on save, `remove` on delete, cleared by `clearAll`, and **rebuilt from disk** on the two paths where sync writes files underneath the store (iCloud's `onDidPull`, Drive's `reloadIndex`).

Because the sets are `@Published`, a transcript finishing or a download landing still refreshes the dependent UI — previously that depended on adjacent publishes (`jobs`, `records`) happening to fire at the right time.

`localAssetURL` (which genuinely needs to find the file and its extension) still probes, but it's called on playback start and delete — not per render.
