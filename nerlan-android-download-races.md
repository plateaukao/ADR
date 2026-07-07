2026-07-08

# NerLan: download state updates were racy read-modify-writes

## What was broken

`DownloadManager` allows three concurrent audio downloads (a semaphore over
OkHttp's synchronous `execute()`), yet mutated its shared state with plain
`MutableStateFlow.value +=` / `-=` — a non-atomic read-modify-write:

- Two downloads publishing progress or finishing together could lose an update.
  Losing the `finally { _progress -= id }` removal leaves a spinner stuck
  forever and blocks re-downloading that episode until app restart (both
  `isDownloading` and the UI key off that map).
- Two finishes could lose a record from `_records` — a downloaded episode that
  never appears in the Downloads tab.
- `downloads.json` was written directly from those concurrent coroutines *and*
  synchronously from `delete()` on the main thread; two interleaved
  truncate-then-write sequences can corrupt the JSON, which the loader silently
  turns into an empty list — wiping the whole downloads index.

## Fix

- All `_progress`/`_records` mutations use `update {}` (compare-and-set).
- `downloads.json` writes go through one mutex-serialized writer that re-reads
  `_records.value` inside the lock, so the last write always carries the newest
  state. `delete()`'s file write moves off the main thread as a side effect.

## Verification

On the emulator: started downloads on EP01–EP03 within one second (the
semaphore runs all three concurrently); all three completed with three audio
files on disk, `downloads.json` holding exactly the three records, and no stuck
progress indicators. Swipe-deleting EP01 from the Downloads tab left two
records and two files — the async serialized write path persists correctly.

Commit: `641e12c` in nerlan-android.
