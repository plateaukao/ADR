2026-07-08

# NerLan: adjustResize was declared where Android never reads it

## What was broken

`android:windowSoftInputMode="adjustResize"` sat on the `<application>` element.
The attribute is documented as activity-level only; on `<application>` Android
silently ignores it, so the app actually ran with the default soft-input mode
and the on-screen keyboard could cover focused text fields (API key, model
names) instead of resizing the content.

## Fix

Moved the attribute onto `<activity android:name=".MainActivity">`.

## Verification

`aapt2 dump xmltree` on the built APK shows
`windowSoftInputMode(0x0101022b)=0x00000010` (SOFT_INPUT_ADJUST_RESIZE) on the
MainActivity element — the place the framework reads it from. Behavioral
verification wasn't possible on the emulator: it has a hardware keyboard
profile, so the soft IME never shows (`mInputShown=false` regardless of focus).
App launch and Settings input were regression-checked.

Commit: `5c71bd3` in nerlan-android.
