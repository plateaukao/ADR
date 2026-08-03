2026-08-03

# WhisperASR: NSLock.withLock for Swift 6 Async Contexts

## What was wrong

The v0.9.0 release build surfaced six new compiler warnings from the live-transcription-model change: `TranscriptionService` called `liveStateLock.lock()` / `.unlock()` directly inside `transcribe()` and `preloadLiveModel()`, which are async functions. NSLock's `lock`/`unlock` are marked unavailable from asynchronous contexts — a warning today, but an error once the package moves to the Swift 6 language mode. (Holding a lock across a suspension point can deadlock; the annotation exists to keep manual lock/unlock pairs out of async code entirely.)

## The fix

All accesses to the `liveNemotronActive` flag now go through `NSLock.withLock { }` — the scoped, synchronous form that acquires and releases within a single non-suspending closure, which is exactly how the flag was already being used. No behavior change; the sync `unloadLiveModel()` site was converted too for consistency. Build is warning-free again (apart from the pre-existing FluidAudio resource notice).
