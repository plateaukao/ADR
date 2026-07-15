# dpt-cp1-home-assistant: initial fork for DPT-CP1

## Summary

Forked `plateaukao/AssistiveTouch` to a new project, `dpt-cp1-home-assistant`, to give the Sony DPT-CP1 A5 digital paper tablet a software replacement for its broken physical home button. The fork retains the floating-overlay + drag + edge-snap UX of the upstream but rebuilds the gesture logic and lowers the SDK floor so it actually runs on the DPT-CP1's Android 5.1 firmware. The long-press is wired to a Sony-specific broadcast we discovered by inspecting the device — that's how the physical home button worked originally, and it lets the original applauncher come back to life.

Pushed to `github.com/plateaukao/dpt-cp1-home-assistant` (public).

## Approach

### Diagnosing what the broken button used to do

The device exposes three input devices (`/dev/input/event0..2`). The keypad driver (`pxa27x-keypad`) advertises `KEY_RIGHT / KEY_MENU / KEY_BACK / KEY_HOMEPAGE` in its `EV_KEY` capability bitmap, and the keylayout file `/system/usr/keylayout/pxa27x-keypad.kl` maps Linux scancode 102 → Android `HOME`. That's misleading on its own — the home button on DPT-CP1 is **not** dispatched through Android's normal `KeyEvent` path at all. Inspecting `dumpsys package com.sony.apps.applauncher` revealed a registered broadcast receiver:

```
com.sony.infras.DPExtensions.MenuKeyHandler.MENU_KEY_PUSHED
  -> com.sony.apps.applauncher/.presentation.receiver.MenuKeyReceiver
```

Sony has its own `DPExtensions` framework that consumes the keypad event and re-emits a custom broadcast which their stock applauncher listens for. The receiver has no permission gate, so any unprivileged app can fire it via `sendBroadcast(...)`. That single discovery is what made the long-press gesture feel "right" — it reproduces the physical button exactly.

### Gesture design tuned for e-ink

`GestureDetector.onDoubleTap` uses `ViewConfiguration.getDoubleTapTimeout()` (about 300 ms). On the DPT-CP1's slow Mobius panel, the user can't reliably lift, recover, and re-tap inside 300 ms, so the built-in detector misses double-taps. Replaced it with a manual `Handler`-based state machine:

- `ACTION_DOWN` schedules a long-press runnable at +600 ms.
- `ACTION_MOVE` past a 15 dp threshold cancels long-press and starts dragging.
- `ACTION_UP` (no drag, no long-press fired):
  - if a prior tap is pending and within 800 ms → cancel its delayed BACK, fire HOME.
  - otherwise → record `lastTapAt` and schedule BACK at +800 ms.

The 800 ms double-tap window is a deliberate tradeoff: single-tap BACK has a visible 800 ms delay, but the longer window makes double-tap reliably catchable on e-ink. 500 ms was tested and missed too often.

### API 22 surgery on the fork

Upstream targets API 26+; the DPT-CP1 is API 22. Changes:

- `WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY` (API 26) → `TYPE_PHONE`. This avoids the API 23+ `SYSTEM_ALERT_WINDOW` runtime grant flow entirely — on Lollipop it's an install-time permission.
- Dropped the `Settings.canDrawOverlays` / `ACTION_MANAGE_OVERLAY_PERMISSION` path in `MainActivity`.
- Removed the unused `GestureDescription`/`dispatchGesture` code (API 24+) and `disableSelf()` (API 24).
- `paddingVertical` / `paddingHorizontal` XML attrs (API 26) → `paddingStart/End/Top/Bottom`.
- Fixed a latent bug in the upstream `accessibility_service_config.xml` where `android:packageNames="…assisttouch.service"` was filtering events to only its own service's package — replaced with no filter so events arrive globally.
- Dropped `android:canPerformGestures="true"` since the gesture API is API 24+.
- Bumped Gradle wrapper from 8.0 to 8.7 (8.0 cannot read JDK 21 class files; current Android Studio Preview ships JDK 21).
- Renamed package from `com.android.mirror.assisttouch` to `info.plateaukao.dptcp1home`.

### Long-press wiring

Earlier iterations tried two paths before landing on the broadcast:

1. `performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)` — works but opens the system shade, not Sony's app drawer.
2. `Runtime.exec(["su", "-c", "input keyevent 82"])` — works because the device has unrestricted root (`test-keys` build), but `KEYCODE_MENU` does nothing on Sony's stock UI since their handler intercepts before the normal Android key path.

The broadcast approach replaced both. No root, no special permission, exactly the original behavior.

## Trade-offs

- **Back has an 800 ms delay.** Necessary so that a second tap can be paired into a double-tap. Adjustable via `DOUBLE_TAP_WINDOW_MS`.
- **`targetSdkVersion 22`.** AGP warns and Play Store wouldn't accept it, but the app is sideloaded only. Keeping the target low avoids any chance of newer overlay-window restrictions kicking in on the DPT-CP1.
- **`TYPE_PHONE` is deprecated.** Replaced by `TYPE_APPLICATION_OVERLAY` on API 26+; we don't care because we explicitly target API 22.
- **Long-press only works on DPT-RP1/CP1.** The `MENU_KEY_PUSHED` broadcast is meaningful only to Sony's `applauncher`. On any other device, long-press is a no-op (no fallback registered — could add `GLOBAL_ACTION_NOTIFICATIONS` as a fallback later if portability matters).
- **Accessibility-service grant resets on package replace.** Standard Android security behavior on this Lollipop build — after every `adb install -r`, the service must be re-toggled in Settings.

## Key Files

- `app/src/main/java/info/plateaukao/dptcp1home/service/AssistiveTouchService.java` — accessibility service, floating-window plumbing, gesture state machine, the Sony broadcast at `openSystemMenu()`, `goHome()` using `GLOBAL_ACTION_HOME` + `CATEGORY_HOME` intent fallback.
- `app/src/main/java/info/plateaukao/dptcp1home/main/MainActivity.java` — launcher activity that routes the user to Accessibility settings the first time and then `finish()`-es out.
- `app/src/main/java/info/plateaukao/dptcp1home/utils/SystemsUtils.java` — display metrics + `isAccessibilityServiceEnabled` check.
- `app/src/main/res/layout/assistive_touch_layout.xml` — 90 dp ImageView for the floating dot (1.5× the upstream 60 dp; with proportional padding).
- `app/src/main/res/xml/accessibility_service_config.xml` — declares the service capabilities; deliberately no `packageNames` filter and no `canPerformGestures`.
- `app/src/main/AndroidManifest.xml` — declares `SYSTEM_ALERT_WINDOW`, the launcher activity, and the bound accessibility service.
- `app/build.gradle` — `minSdk 22`, `targetSdk 22`, `compileSdk 34`, namespace `info.plateaukao.dptcp1home`.
- `gradle/wrapper/gradle-wrapper.properties` — Gradle 8.7 (JDK 21-compatible).
- `README.md` — usage + tunables + the Sony broadcast trick documented for future readers.
