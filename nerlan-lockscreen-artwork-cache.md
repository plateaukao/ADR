2026-07-07

# NerLan: lock-screen artwork uses the cover cache and can't go stale

## What was broken

`PlayerManager.updateNowPlayingInfo()` fetched the episode cover for the lock screen with a raw `URLSession.shared.data(from:)` on every episode load. Two problems:

1. **Redundant downloads.** The app already has `CoverImageCache` (memory → disk → network, deduplicated in-flight) precisely because the Channel+ image endpoint sends no `Cache-Control`. The now-playing path bypassed it, so listening through a course re-downloaded the same program cover once per episode.
2. **Stale artwork race.** The completion wrote `MPMediaItemPropertyArtwork` into `nowPlayingInfo` unconditionally. Skip to the next episode while the fetch is in flight and the *previous* episode's cover lands on the *new* episode's lock-screen entry.

## Fix

The artwork task now awaits `CoverImageCache.shared.image(for:)` (usually a memory hit for sequential episodes of one program) and, before writing, re-checks that `current?.id` still matches the episode the fetch was started for — a late arrival for a superseded episode is simply dropped. The next episode's own `updateNowPlayingInfo` call supplies its artwork.
