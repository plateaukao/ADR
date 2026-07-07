2026-07-08

# NerLan: activity recreation during controller connect could double-count all listening time

## What was broken

`PlayerManager.initialize()` (called from `MainActivity.onCreate`) guarded
re-entry with `if (controller != null) return` — but `controller` is only
assigned inside the `buildAsync` completion listener. If the activity was
recreated during the connection window (fold/rotate/theme change at cold
start), the second `initialize()` passed the guard and:

- built a second `MediaController` (the superseded one never released — a leaked
  service binding), and
- launched a second infinite 500 ms stats loop. Both loops call
  `stats.addListening` — and since the listening stats are a synced G-counter
  whose partitions are summed, everything counted while two loops ran was
  **permanently** doubled.

`future.get()` was also unguarded: a failed connection would throw
`ExecutionException` on the main thread and crash.

## Fix

- A synchronous `initializeStarted` flag closes the re-entry window (initialize
  is main-thread only).
- `future.get()` is wrapped; on failure the flag resets so the next activity
  launch retries instead of leaving the player permanently dead.
- The stats poll is keyed to a single `Job` so even a retried initialize can
  never start a second counting loop.

## Verification

On the emulator: started playback, forced two activity recreations via dark-mode
toggles (`cmd uimode night yes/no`) mid-playback — playback continued (session
stayed PLAYING with the same episode) and transport controls still worked after
recreation (pause tap → PAUSED). The millisecond connect-window race itself is
not externally triggerable; the synchronous guard covers it by construction.

Commit: `08f5862` in nerlan-android.
