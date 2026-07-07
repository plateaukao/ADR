2026-07-08

# NerLan: one source of truth for AI content kinds across the sync stack

## Why

Four AI artifacts (transcript, handout, cues, translation) flow through three storage layers, and each layer had its own hand-written copy of the same mapping:

- `ICloudSync.Kind` — local subdir, local extension, cloud filename
- `DriveSync.contentFiles` — subdir/prefix/extension tuples for the push side
- `DriveSync.writeContent` — prefix/suffix/subdir/extension tuples for the pull side
- `DriveSync.isContentName` — the prefixes and suffixes a third time

plus three copies of the "valid episode id" predicate (ASCII letters/digits/hyphens — the guard against junk ids an old iCloud-truncation bug produced). Adding a fifth artifact kind meant editing all of them in lockstep; letting one drift silently breaks a sync direction.

## What changed

`AIContentKind` (new file) owns every name a kind is known by: `localSub`, `localExt`, `cloudFile`, `mime`, `driveName(id:)`, `parseDriveName(_:)`, and `isValidEpisodeId(_:)`. The consumers:

- `ICloudSync.Kind` is now `typealias Kind = AIContentKind` — zero call-site churn.
- `DriveSync`'s four mappings collapse to `allCases` iteration and `parseDriveName`.
- `AIContentStore.cleanupMalformedLocalContent` and `ICloudSync.parsedId` share `isValidEpisodeId`.

Two small behavior improvements fell out: DriveSync's *push* side now skips junk-id local files (it previously uploaded them), and the *pull* side rejects junk-id remote names before downloading (previously it downloaded, then discarded at write time).
