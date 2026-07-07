2026-07-07

# NerLan: Drive file listing follows nextPageToken

## What was broken

`DriveSync.listFiles` asked for `pageSize=1000` and returned after one request, never following `nextPageToken`. The mirror stores 4 content files per fully-processed episode (transcript, handout, cues, translation) plus per-device stats blobs and the metadata JSONs — so past roughly 250 processed episodes the listing silently truncates.

Everything beyond the first page then looked *absent from the remote*: `syncContentFiles` classified those local files as "local-only" and `upsert`ed them with `existingId: nil` — and Drive's `appDataFolder` happily stores same-named duplicates, so every sync created another copy of each unlisted file. The name-keyed map (`uniquingKeysWith { first, _ in first }`) then picked among the duplicates arbitrarily.

## Fix

The listing loops, appending each page's files and passing `nextPageToken` back until it's exhausted; `fields` now includes `nextPageToken`. Existing duplicates from the old behavior are harmless (content files are write-once and identical) but can be cleaned up server-side later if desired.
