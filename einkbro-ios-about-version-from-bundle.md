2026-08-04

# EinkBro iOS: the About row reads its version from the bundle now

Right after installing 1.2, the Settings → About row still said **v0.1.0** — three versions stale. The port's `BuildConfig` shim (the commonMain stand-in for Android's generated `BuildConfig`) carried a hardcoded `VERSION_NAME = "0.1.0"` that nobody remembered to bump alongside `Info.plist`, because nothing forced them to move together.

The fix removes the second source of truth instead of updating it: `VERSION_NAME` became a getter backed by an `expect fun appVersionName()`, whose iOS actual reads `CFBundleShortVersionString` from `NSBundle.mainBundle` at runtime. `Info.plist` is now the only place a version lives; the About row can't rot again. Verified in the simulator ("About EinkBro v1.2") and shipped to the phone.

Commit `01e4465` (einkbro-ios), pushed with the 1.2 release-prep series.
