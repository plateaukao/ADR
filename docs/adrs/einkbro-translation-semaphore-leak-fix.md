# einkbro: Always release translation semaphore on error

## Problem

After translation failures, page translations would mysteriously stop working until the app was restarted. The effect was strongest on Gemini, where translation requests run with a semaphore of 1, but it could affect any provider over time.

## Root Cause

`JsWebInterface.getTranslation` acquired a per-API semaphore permit before performing the translation:

```kotlin
semaphore.acquire()
val translatedString = performTranslation(...)
// ...write to cache, post to WebView, sleep for rate limit...
semaphore.release()
```

If anything between `acquire()` and `release()` threw — `performTranslation` itself, `bookmarkManager.insertTranslationCache`, the main-thread `evaluateJavascript`, or `delayIfNeeded` — control left the function without releasing the permit. Each leak permanently shrunk the available concurrency. With Gemini's semaphore of 1, a single thrown exception was enough to stall every subsequent translation.

## Solution

Wrap the body in `try { ... } finally { semaphore.release() }` so the permit is always returned, even on exceptions. The happy path is unchanged.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/browser/JsWebInterface.kt` — `getTranslation`

## Lessons Learned

- Any `acquire()` paired with a later `release()` should be bracketed by `try/finally` (or `withPermit { }`) the moment the work between them can throw — and almost everything can throw.
- Bugs that look like "the feature stopped working until restart" are a tell for resource-leak shapes: file handles, locks, semaphores, listeners. Look for `acquire`/`release`, `lock`/`unlock`, `register`/`unregister` pairs that aren't in `finally`.
- Single-permit semaphores make leaks immediately fatal to throughput, which is also a useful diagnostic: if a feature breaks for one API but not others, check whether that API has tighter concurrency limits.
