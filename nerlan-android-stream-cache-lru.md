2026-07-08

# NerLan: the streamed-audio cache is now bounded (2 GB LRU)

## What was broken

The opt-in stream cache (`cacheDir/audio`, written through `CacheDataSource`
while streaming) was created with `NoOpCacheEvictor` — no size cap, no
eviction. A user who streams daily accrues gigabytes; since the cache lives in
`cacheDir`, the OS purges it **wholesale** under storage pressure, defeating
the offline-replay purpose exactly when it mattered.

## Fix

`LeastRecentlyUsedCacheEvictor(2 GB)`. Spoken-audio episodes run ~3–8 MB per
5-minute episode (larger for hour-long shows), so 2 GB keeps roughly the last
30–60 played episodes and evicts the oldest-played first, gracefully.

## Verification

On the emulator with 串流時自動快取 enabled: streaming a fresh episode wrote a
`.v3.exo` span into `cache/audio` (~2 MB after a few seconds) — the cache
write path works through the LRU evictor. (One catch found while verifying:
`shouldWrite` is read per episode *load*, so an episode already playing when
the toggle flips keeps its no-write source — documented behavior in the
factory, a new load picks the setting up.) The 2 GB eviction bound itself
can't be practically exercised in a test; the evictor is stock Media3.

Commit: `e7eafca` in nerlan-android.
