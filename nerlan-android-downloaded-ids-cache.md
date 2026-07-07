2026-07-08

# NerLan: downloaded-state checks no longer stat the filesystem per row

## What was wasted

`DownloadManager.isDownloaded(id)` probed up to seven candidate paths
(`id.mp3`, `id.m4a`, …) with `File.exists()` on every call. The UI calls it per
visible episode row per recomposition (program detail, favorites, player sheet),
so scrolling a long list — or any download progress step recomposing visible
rows — issued hundreds of redundant main-thread `stat()` syscalls. Slow flash on
the e-ink devices this app targets makes that visible.

Separately, a download interrupted by process death left its `{id}.ext.part`
temp file in `files/audio/` forever: invisible in the UI, but counted by
`downloadedBytes()`, so the 資料統計 screen over-reported storage.

## Fix

One directory scan at startup seeds a `ConcurrentHashMap<String, File>` of
completed downloads; download completion and deletion keep it current.
`isDownloaded`/`localPath` are now map lookups. The same startup scan deletes
stale `.part` files in both the audio and attachments directories.

## Verification

On the emulator, the full lifecycle:

- planted `deadbeef.mp3.part` via `run-as`, restarted — swept on startup;
- downloaded EP01 from the player sheet — button flipped to 已下載, file present;
- restarted the app — Downloads tab still lists EP01 (map seeded by the scan);
- swipe-deleted the row — row gone and `files/audio/` empty.

Commit: `2d12311` in nerlan-android.
