2026-08-29

# CalliPlus: a `-PnoAds` release build for personal devices

The user wanted CalliPlus on their own e-ink devices (Hisense A7, Boox Tab Ultra C) without the banner ad, while keeping the Play build unchanged. `./gradlew assembleRelease -PnoAds` now produces a release-signed, minified APK that never touches the ad SDK.

## How it works

`app/build.gradle` `defaultConfig` adds one `buildConfigField`:

```groovy
buildConfigField "boolean", "ADS_ENABLED", project.hasProperty('noAds') ? "false" : "true"
```

Two call sites check it:

- `UILApplication.onCreate` skips `Ads.initialize(this)` when `ADS_ENABLED` is false, so the Google Mobile Ads Next-Gen SDK is never started (no background init thread, no UMP consent work).
- `BaseActivity.onStart` returns before creating the `AdView` when `BuildConfig.DEBUG || !BuildConfig.ADS_ENABLED` — the same early-out the debug build already had.

Nothing else changes: same `applicationId`, `versionCode`, `versionName`, and keystore signing as the Play build. That was the point — the APK installs *over* a locally-signed install without an uninstall, and R8 still runs so the artifact matches what ships.

## Why a Gradle property, not a flavor or build type

A second flavor would resurrect the free/paid split the project just removed, double every `assemble*` task, and need its own R8/resource-shrink pass to verify. A property is one line, invisible to the default build, and can't be selected by accident from the Play publishing tasks (which don't pass it).

## Caveats found while installing

- The Pixel and the Boox originally carried the **Play Store** build, which is signed with the Play App Signing key — a different key from the local upload keystore. Sideloading any locally-signed APK over it fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`; the only route is uninstalling the Play build first (loses settings and search history; the character DB is bundled so nothing else is lost). The user did that by hand on the Boox. Once sideloaded, Play no longer auto-updates that device, so each release needs a manual `-PnoAds` reinstall there.
- The Boox firmware runs at 450 dpi rather than the panel's physical 300 dpi, which makes its 1860 px width only 661 dp — below the `layout-w720dp` breakpoint for the two-pane character layouts. The user changed the app's DPI in Boox's per-app settings rather than lowering the breakpoint in the app.
