2026-07-08

# NerLan: listening-stats writes serialized and made atomic

## What was broken

`ListeningStatsStore` persists this device's tally as one JSON blob. Persists
fire every ~5 s of listening, on every pause, and on completions — each as
`scope.launch { ownFile.writeText(...) }` on the **parallel** IO dispatcher.
Two consequences:

- Out-of-order completion: a pause-flush racing the 5 s tick could write an
  older snapshot last, silently rolling the tally back.
- Interleaved truncate-then-write: corrupt JSON. `init` reads it with
  `runCatching { ... }.getOrNull()`, i.e. corrupt = "no stats" — wiping the
  device's listening history, which then syncs to Drive as this device's
  G-counter partition (the loss becomes permanent across devices).

## Fix

Writers serialize behind a `Mutex`. A sequence number assigned under the state
lock (so it matches snapshot order) lets late-arriving stale snapshots be
dropped — newest always wins. The write itself is temp-file + `renameTo`, so a
process death mid-write leaves the previous intact file, not a truncated one.

## Verification

On the emulator: ~12 s of playback (two 5 s persist ticks) ending in a
pause-flush — the racy sequence this targets. The file stayed valid JSON, the
daily tally advanced by exactly the played ~10 s (420.4 → 430.5), and no
leftover `.tmp` remained.

Commit: `3b3021c` in nerlan-android.
