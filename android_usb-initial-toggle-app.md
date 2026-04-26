# android_usb — Initial USB-Debugging Toggle App

## Problem
Needed a minimal Android app that lets the user enable/disable USB debugging from a single switch on the main screen, rather than navigating into Developer Options each time.

## Root Cause
USB debugging is exposed only as a system-level flag (`Settings.Global.ADB_ENABLED`). Writing to it requires `WRITE_SECURE_SETTINGS`, which is signature-level — regular apps cannot toggle it without an explicit ADB grant or system-app status. Without a thin wrapper UI, users have no way to script or one-tap this from a normal app.

## Solution
Created an empty-activity Compose project (`android create empty-activity`) and replaced the template's data-driven `MainScreen` with a `UsbDebuggingScreen` that:
- Reads `Settings.Global.ADB_ENABLED` on first composition.
- Registers a `ContentObserver` on the ADB_ENABLED URI in a `DisposableEffect` so the switch stays in sync with external changes (e.g., toggling from Developer Options).
- On switch change, calls `Settings.Global.putInt(...)` inside a try/catch. On `SecurityException` (no grant), shows a Toast with the grant command and falls back to launching `Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS`.
- Adds the `WRITE_SECURE_SETTINGS` permission to the manifest with `tools:ignore="ProtectedPermissions"` so the build accepts it.

Refactored the package id from `com.example.androidusb` to `info.plateaukao.androidusb` (namespace + applicationId in `app/build.gradle.kts`, source directory move, package/import updates across all Kotlin files). Deleted the now-unused template scaffolding (`MainScreenViewModel`, `DataRepository`, and their tests). Initialized git, wrote a README documenting the grant command, and pushed to `github.com/plateaukao/android_usb` (public).

The runtime grant required:
```
adb shell pm grant info.plateaukao.androidusb android.permission.WRITE_SECURE_SETTINGS
```

## Key Files
- `app/src/main/java/info/plateaukao/androidusb/ui/main/MainScreen.kt` — `UsbDebuggingScreen` composable, `ContentObserver` wiring, write/fallback logic.
- `app/src/main/AndroidManifest.xml` — `WRITE_SECURE_SETTINGS` declaration with the grant command in a comment.
- `app/build.gradle.kts` — `namespace` and `applicationId` set to `info.plateaukao.androidusb`.
- `README.md` — install / grant / build instructions.
- `.gitignore` — extended with `**/build/` to also exclude module-level build dirs.

## Lessons Learned
- The default Android `.gitignore` from the `android create` template only excludes `/build` at the project root; module build outputs under `app/build/` slip through. Add `**/build/` early or risk committing artifacts.
- The empty-activity template ships with a sample `DataRepository` + `ViewModel` + UI/unit tests. When repurposing the screen, delete them rather than leave dead code — leftover tests will reference removed overloads and fail compilation.
- `WRITE_SECURE_SETTINGS` is signature-level. Declaring it in the manifest is necessary but not sufficient; the install pathway needs `pm grant` (or system-app placement). The UX must assume the grant is missing and degrade gracefully — a Toast plus an Intent to Developer Options is the right fallback.
- Use a `ContentObserver` rather than polling for system settings: the URI from `Settings.Global.getUriFor(...)` fires immediately on external changes, keeping the switch consistent without timer logic.
- Renaming an Android applicationId requires uninstalling the old package on the device before installing the new one — otherwise both linger and the launcher gets confused.
