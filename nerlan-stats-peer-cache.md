2026-07-07

# NerLan: listening-stats accessors stop re-reading peer files per call

## What was broken

The 使用統計 screen reads ~9 accessors (`totalSeconds`, `secondsToday/Week/Month`, `currentStreak`, `completedCount`, `hourlyTodayStats`, `dailySeries`, `topPrograms`). Every one of them called `mergedStats()`, which on **every call**:

- enumerated the `stats-peers/` directory and `Data(contentsOf:)` + `JSONDecoder`-decoded every peer device's blob, and
- copied the entire `NSUbiquitousKeyValueStore.dictionaryRepresentation` and decoded every stats entry in it.

The screen recomputes all accessors whenever `revision` changes — and `addListening` bumps `revision` on every 0.5s playback tick. So with the stats screen open during playback: ~9 × (N peer files read + decoded + a full KVS copy), on the main actor, twice a second, to display data that only actually changes when *another device's* blob arrives.

## Fix

Peer blobs load once into a `PeerCache` whose key is the pair of flags it was assembled under (`syncing` for KVS, `syncToDrive` for the Drive peers dir). The cache drops on exactly the events that can change peer data:

- the KVS `didChangeExternally` notification (another device pushed),
- `reloadDrivePeers()` (a Drive pull rewrote `stats-peers/`),
- a sync-mode flip (covered by the flag key).

This device's own `local` blob is not cached — it's already in memory and mutates per tick, so today's numbers still update live. After the change, an accessor call is a pure in-memory merge.
