2026-07-07

# NerLan: tapping an audio-less episode played the wrong one

## What was broken

`PlayerManager.play(record, queue)` filters the queue to items with a non-null
audio URL, then located the tapped record with
`indexOfFirst { it.id == record.id }.coerceAtLeast(0)`. When the tapped record
itself has no audio — reachable for NER catalog episodes whose `voice?.voiceRef`
is missing, since `Episode.audioUrl` is nullable (podcast feeds are safe: the RSS
parser drops enclosure-less items) — `indexOfFirst` returns -1 and the coercion
silently started **index 0**, i.e. some other episode. `_current` was also set to
the tapped record, so the UI briefly disagreed with what was audibly playing.
With no playable item in the queue at all, `setMediaItems(emptyList)` +
`prepare()` reaches `STATE_ENDED` immediately, which the player listener counts
as a completion of the stale `_current` — a bogus entry in the synced listening
stats.

## Fix

Return early when the tapped record isn't in the playable queue, instead of
coercing to 0. (The empty-queue case is covered by the same check.)

## Verification

The common path was regression-checked on the emulator: tapping EP02's row plays
EP02. The degenerate branch is an early return verified by construction — the
live catalog had no episode with a missing voice ref to drive it end-to-end.

Commit: `553b9f7` in nerlan-android.
