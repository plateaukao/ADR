2026-07-15

# EinkBro: respect the system rotation lock during fullscreen video

## What was broken

Issue #584 reported that EinkBro "ignores the system-level rotation lock and continues to rotate automatically when I move the device" even with auto-rotate off and the tablet locked to landscape.

Auditing every orientation write in the app narrowed the possibilities fast: there is no `android:screenOrientation` in the manifest, the manual rotate action toggles between `UNSPECIFIED` and `LANDSCAPE` (both lock-respecting), and the only sensor-driven value in the codebase was in `FullscreenDelegate.onShowCustomView` — fullscreen video set `SCREEN_ORIENTATION_FULL_SENSOR`. `FULL_SENSOR` explicitly follows the physical sensor *regardless of the user's auto-rotate setting*, so any time a video went fullscreen, the app visibly overrode the system rotation lock. A user who watches video content hits this constantly and reasonably describes it as "the app ignores my rotation lock" without connecting it to fullscreen playback.

Verified on an emulator with auto-rotate off: normal browsing correctly stayed put when the device was rotated, but entering fullscreen video immediately flipped the display to follow the sensor (`requestedOrientation=SCREEN_ORIENTATION_FULL_SENSOR`, display rotation changed). The restore path on exiting fullscreen was correct, so the violation is scoped to while fullscreen is active — but that is exactly when people physically handle a tablet the most.

## The fix

One value: `FULL_SENSOR` → `SCREEN_ORIENTATION_FULL_USER`. `FULL_USER` grants the same freedom when the user allows it, and defers to the lock when they don't:

| | auto-rotate ON | rotation LOCKED |
|---|---|---|
| `FULL_SENSOR` (before) | rotates, all 4 orientations | **rotates anyway — the bug** |
| `FULL_USER` (after) | rotates, all 4 orientations | honors the lock |

Both rows verified on the emulator: with the lock on, fullscreen video now stays in the locked orientation under sensor pressure; with auto-rotate on, it still rotates freely through all four orientations (including reverse portrait, which plain `SCREEN_ORIENTATION_USER` would not allow — `FULL_USER` keeps the video-friendly behavior).

The issue also asked for an in-app orientation toggle; that already exists as the "Rotate screen" toolbar action, so the code change is only the fullscreen policy.

Fixed in commit `9ed2a471d`.
