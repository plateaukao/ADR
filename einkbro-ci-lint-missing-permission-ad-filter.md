2026-08-23

# EinkBro: CI failed on lint after the WorkManager removal

Every CI build from `758815b18` (WorkManager replaced by a coroutine filter
updater) through the v16.4.0 tag failed, while the local builds and tests
that gated each commit passed. The failing task was `:ad-filter:lintDebug`.

## What was wrong

The new `FilterUpdater` calls `ConnectivityManager.registerNetworkCallback`,
`getActiveNetwork` and `getNetworkCapabilities` to wait for connectivity
before downloading a filter list. Those need `ACCESS_NETWORK_STATE`. The
commit did add that permission - but to the **app** manifest, because that
is where it was discovered to be missing (WorkManager's own manifest had
been supplying it, and the status-bar Wi-Fi icon depended on it too).

Lint's `MissingPermission` check is evaluated per module against that
module's own manifest. The calls live in the `ad-filter` library, whose
manifest was an empty `<manifest />`, so lint reported three errors there.
The app module was fine, which is why nothing failed locally: the
pre-commit gate was `./gradlew test` (plus `assembleRelease`), not the
`testDebugUnitTest lintDebug` pair that CI runs.

## Fix

Declare the permission in `ad-filter/src/main/AndroidManifest.xml`, the
module that uses it. Manifest merging carries it into the app, so the app's
own declaration (still needed by the status bar) is simply redundant rather
than the sole source. `./gradlew testDebugUnitTest lintDebug` - the exact CI
command - passes locally; CI went green on `7cd2c77fd`.

## What to take from it

A library module that starts calling a permission-guarded API needs the
`<uses-permission>` in *its* manifest, not only in the app's. And the local
gate before pushing should be the same command CI runs, not a superset that
happens to skip lint.
