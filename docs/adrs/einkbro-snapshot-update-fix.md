# EinkBro: Fix snapshot update stuck state and slow extraction

## Problem
When updating via snapshot, the download percentage reaches 100% but the installation screen sometimes doesn't appear. Additionally, the update button becomes permanently disabled, preventing re-triggering the install.

## Root Cause
Three issues:

1. **Stuck button state**: The action lambda in `SettingActivity` used `lifecycleScope.launch(Dispatchers.IO)` which is fire-and-forget. The UI's `finally` block (which resets `isRunning`) ran immediately after launch returned, then the background coroutine set `isRunning = true` again via progress callbacks. When the work finished, nothing reset `isRunning` back to false, permanently disabling the button.

2. **Install screen not showing**: `installApkFromFile` called `context.startActivity()` from `Dispatchers.IO`. On some devices/Android versions, starting activities from a background thread can silently fail.

3. **10+ second delay after download**: After download completed, `zipInputStream.copyTo(fos)` extracted the full APK (~20-30MB) with no progress feedback. On E-ink devices with slow flash I/O, this appeared as a hang.

## Solution
- Changed `lifecycleScope.launch` to `withContext` so the suspend lambda properly awaits, and the `finally` block runs at the correct time.
- Wrapped `startActivity` in `withContext(Dispatchers.Main)`.
- Added byte-level progress reporting during ZIP extraction.
- Changed ZIP entry matching from exact name to `.apk` suffix, with an error thrown if no APK is found.

## Key Files
- `app/src/main/java/info/plateaukao/einkbro/activity/SettingActivity.kt` — coroutine scoping fix
- `app/src/main/java/info/plateaukao/einkbro/unit/HelperUnit.kt` — install thread, extraction progress, ZIP matching

## Lessons Learned
- `lifecycleScope.launch` inside a suspend lambda is fire-and-forget and breaks structured concurrency — use `withContext` to properly suspend.
- Progress UI that gates re-triggering on `isRunning` must ensure the flag is always reset, even when the work is delegated to a different coroutine scope.
- Silent file I/O (like ZIP extraction) on slow storage devices needs progress feedback to avoid appearing frozen.
