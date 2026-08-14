2026-08-14

# Sweet LIME 7.6.0 release

Cut release 7.6.0 (versionCode 760) to ship the three changes that had accumulated on master since v7.5.0 (released 2026-08-06). One is a feature, so this is a minor-version bump rather than a same-version re-tag (the re-tag flow is reserved for immediate post-release fixes).

## What shipped

- **feat:** 超大 (1.4x) / 極大 (1.6x) keyboard size options for tall screens — key heights are fixed dp values tuned for old screens, so on tall modern phones the keyboard looked undersized; the previous maximum was 特大 (1.2x). `keyboard_size` got its own entry array so font-size options stay unchanged.
- **fix:** voice input mic silently failing on newer Android — with targetSdk 33 and no `<queries>` declaration, package-visibility filtering on retail Android 16/17 builds hid all IMEs from `getEnabledInputMethodList()`, so voice-IME detection always came back empty. Fixed with an `android.view.InputMethod` query plus a toast when no voice IME is available.
- **fix:** no way back from the number pad opened by long-pressing 123 — the phone layout's only exit closed the IME; its done key is now a 中 key (code -10) that routes through `initialIMKeyboard()` and resets the switcher mode.

## Release mechanics

Standard flow: bump `versionCode`/`versionName` in `LimeStudio/app/build.gradle`, commit, tag `v7.6.0`, push branch and tag, build the signed release (`./gradlew clean assembleRelease` with the browser.keystore signing params and `-PshowUpdateButton=true`), then `gh release create v7.6.0` with `app-release.apk` attached. Build was clean (23s); APK ~4.2 MB.
