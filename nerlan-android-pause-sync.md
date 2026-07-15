2026-07-08

# NerLan: pausing no longer schedules a Drive sync

## What was wasted

`ListeningStatsStore.flush()` — called from the player listener on every
transition to not-playing — both persisted the tally locally *and* requested a
debounced Drive sync. Shadowing practice pauses the player after every finite
sentence loop, so a 20-sentence session scheduled about 20 full Drive sync cycles
(list + upload round-trips) for a few seconds of tally change: battery, network
and Drive quota spent on nothing.

## Fix

`flush()` persists locally only. Syncing is handled where it belongs: the
`ProcessLifecycleOwner` ON_STOP observer in `NerLanApp` syncs when the app
backgrounds, and `noteCompleted` still requests a sync for the rarer real
milestone (an episode played to its end — also the case that matters during
long background playback, where ON_STOP has already fired).

## Verification

On the emulator: played and paused; `files/listening-stats.json` carries the
session's accumulated tally (420 s for the day, completedCount intact) — the
local persistence path is unchanged. The removed sync call is not observable on
the emulator (Drive is signed out, so requestSync was a no-op here); the change
is a strict removal of work on a hot path.

Commit: `3fc2a41` in nerlan-android.
