2026-05-17

# EinkBro — Sony DPT-CP1 (Android 5.1 / API 22) support

## Summary

Make EinkBro installable and runnable on the Sony DPT-CP1 digital paper:
Android 5.1 (API 22), `armeabi-v7a`. The app previously declared
`minSdk = 24`, so it could not be installed at all on this device.

## Approach

Two layers of change were required:

1. **Build config** — lower `minSdk` 24 → 22. The manifest merger requires
   every module to agree, so `ad-filter` and `adblock-client` (both at 23)
   were lowered to 22 alongside the `app` module.

2. **Runtime API guards** — lowering `minSdk` only changes what the merger
   accepts; unguarded API 23+ calls still throw `NoSuchMethodError` at
   runtime on API 22. These were found by launching the signed APK on the
   device and reading `adb logcat -b crash`; each failure is on the startup
   path so iteration was fast (seconds per cycle):
   - `Activity.checkSelfPermission` (API 23) for `POST_NOTIFICATIONS` in
     `BrowserActivity.onCreate` — gated on `SDK_INT >= TIRAMISU`, since the
     permission itself only exists on API 33+ and notifications are
     auto-granted below that.
   - `ConnectivityManager.getActiveNetwork` (API 23) in
     `Statusbar.isWifiConnected` — added a pre-M branch using the legacy
     deprecated `activeNetworkInfo` API.
   - Direct `Activity.checkSelfPermission` / `requestPermissions` in
     `HelperUnit` (mic, location) — switched to `ContextCompat` /
     `ActivityCompat` wrappers, the pattern already used elsewhere in the
     codebase, which return `PERMISSION_GRANTED` on pre-23.

   `ShortcutManager` paths were already SDK-guarded and
   `needGrantStoragePermission` was already gated `23..28`, so they needed
   no change.

Android Lint's `NewApi` detector was tried as a way to find all offenders
at once, but the existing `lint-baseline.xml` (generated at `minSdk 24`)
interfered and it reported zero `NewApi` issues. Runtime crash-buffer
inspection plus a targeted source grep for common API 23+ calls was the
reliable path instead.

## Trade-offs

- Fixes cover the startup path and a proactive scan of common API 23+
  calls. Less-common features may still hit an unguarded API 23+ call;
  these are easy to patch the same way when a specific crash surfaces.
- This is a device-targeted branch (`for_sony_dpt`), not merged to `main`.
  Lowering the project-wide `minSdk` for one legacy device is a deliberate
  branch-scoped decision, not a default-shipping change.
- The legacy `activeNetworkInfo` Wi-Fi check is coarser than the
  `NetworkCapabilities` path but is the only option on API 22.

## Key Files

- `app/build.gradle.kts`, `ad-filter/build.gradle`,
  `adblock-client/build.gradle` — `minSdk` 24/23 → 22
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt`
- `app/src/main/java/info/plateaukao/einkbro/view/statusbar/Statusbar.kt`
- `app/src/main/java/info/plateaukao/einkbro/unit/HelperUnit.kt`
