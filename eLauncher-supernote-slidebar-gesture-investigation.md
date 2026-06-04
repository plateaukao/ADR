# eLauncher — Supernote slide-bar (side panel) gesture investigation

**Device:** Supernote Nomad (SN100D20041553), eInk
**Date:** 2026-06-04
**Type:** Investigation / reference (no code change)
**Question:** When swiping the bezel slide bar, a system side panel appears. What
event triggers it, can eLauncher intercept it, and what is that panel?

## Summary

The side panel is driven entirely by a **system service inside
`com.ratta.supernote.launcher`** (`GestureService` / `GesturePresenter`,
PID 1486), reacting to a hardware **slide-bar sensor** — not by Android touch
events on the home-app window. The panel itself is **not an Activity**; it is a
`TYPE_PHONE` system overlay window owned by the launcher (uid 1000). eLauncher
**cannot intercept the trigger** — no input is delivered to it — but it can
**observe** the state via a broadcast. This is the same class of vendor
gesture plumbing that `BigmeShims` works around on the Bigme HiBreak.

## Investigation method

1. Cleared the logcat buffer (`adb logcat -c`) and recorded the baseline
   focused window (`dumpsys window | grep mCurrentFocus|mFocusedApp`) — was
   `me.pompel.elauncher/.MainActivity`.
2. Streamed `adb logcat -v time` to a file while the user performed the swipe.
3. While the panel was still up, captured:
   - `dumpsys window` focus + `dumpsys activity activities` (resumed/paused).
   - `dumpsys window windows` for the launcher's window attributes.
   - A screenshot (`adb exec-out screencap`).
4. Grepped the log for the gesture service, the panel package, and any input
   delivered to eLauncher.

Artifacts: `/tmp/supernote_swipe.log` (full trace), `/tmp/supernote_panel.png`
(screenshot).

## Findings

### 1. The trigger is a hardware slide-bar sensor, not a touch event

The bezel slide bar emits custom kernel key events consumed directly by the
launcher's `GestureService` (logcat tag `GMX-GestureService`). Representative
trace:

```
onClick onPressed type:2 action:0 eventkey101 position32     ← finger lands on bar
onSlide            type:2 action:0 eventkey106 position50     ← slide begins
onSlide ... position 69 / 95 / 129                            ← position ramps
onSlide slidePrePosition:32 enableSlidebar:true hand:0
==侧滑菜单:126                                                 ← threshold → "side menu"
showslidebar
launchSlidebarOrStatusbar action---01:showslidebar
GesturePresenter.sendShowSlidebarStatusbar:true
WindowManager addWindow win:Window{ba4444f u0 com.ratta.supernote.launcher}
```

- **Input identity:** `eventkey106` = slide, `eventkey101` = press; `type:2`;
  `position` ramps with finger travel; `hand:0` = side/hand config;
  `enableSlidebar:true` = the feature toggle the service reads.
- **Decision point:** `GestureService.launchSlidebarOrStatusbar()` fires once
  the slide distance crosses the threshold (`==侧滑菜单:126`, "side-slide menu").
- These events never surface as Android `MotionEvent`s on the home-app window.

### 2. A broadcast announces the panel state

```
GesturePresenter.sendShowSlidebarStatusbar
  → sendBroadcast(action = "com.ratta.supernote.launcher.slidebarstatusbarstate")
```

Received by other apps in the trace: `NoteBroadcast`, `Explorer` (file
manager), `PinyinIME`. This is the observable hook available to third-party
apps.

### 3. The panel is a system overlay window, not an Activity

From `dumpsys window windows` for `Window{ba4444f u0 com.ratta.supernote.launcher}`:

| Property | Value |
|---|---|
| Owner package | `com.ratta.supernote.launcher` |
| Owner uid | **1000** (system) |
| Window type | `ty=PHONE` (TYPE_PHONE / 2002) |
| App op | `SYSTEM_ALERT_WINDOW` |
| Surface | translucent, `fillxfill`, 1920×2560 |
| `showForAllUsers` | true |

Crucially, activity state did **not** change:

```
mCurrentFocus = com.ratta.supernote.launcher        ← overlay took focus
mFocusedApp   = me.pompel.elauncher/.MainActivity    ← unchanged
mResumedActivity = me.pompel.elauncher/.MainActivity ← eLauncher never paused
```

So the panel is an overlay drawn on top of the still-resumed eLauncher; it is
not a separate Activity/task.

### 4. Panel contents

The service enables buttons and reads recent files before showing the panel:

```
setBtnEnable RECENT_FILE / NOTE / DOC  Enable=true
canOpenRecentNote info.getLast=/storage/emulated/0/Note/drawing.note
recent doc size=2  last doc=.../Document/...超能路人甲.epub
```

The screenshot confirms a right-edge **side menu**: Recent Files (最近文件),
New Note (新建筆記), Last opened note/doc, Quick Access (快速訪問), and an app
shortcut grid (My Files, EinkBro, OpenSettings, Calendar, KOReader, Settings,
書法加, More) — rendered over eLauncher's 2-column home screen.

### 5. eLauncher receives nothing — cannot intercept the trigger

Every `me.pompel.elauncher` line during the swipe originated from **PID 1486**
(the GestureService inspecting the foreground app), e.g.:

```
GMX-GestureService: top class name=me.pompel.elauncher.MainActivity
AppManagerUtils:     top class:me.pompel.elauncher.MainActivity
ThirdPartyUtils:     packageInfo=me.pompel.elauncher isSystem=false
```

No `MotionEvent`, `KEYCODE_BACK`, or `onBackInvoked` was delivered to eLauncher.
The slide-bar events are handled by the system service **below** the home-app
layer, so `dispatchTouchEvent` / `onBackPressed` in `MainActivity` can neither
see nor block them.

## Event flow

```mermaid
sequenceDiagram
    participant HW as Slide-bar sensor (kernel)
    participant GS as GestureService (launcher pid 1486)
    participant WM as WindowManager (system_server)
    participant Apps as NoteBroadcast / Explorer / IME
    participant EL as eLauncher MainActivity

    HW->>GS: eventkey101 press, then eventkey106 slide (type 2, position ramps)
    Note over GS: accumulate position; enableSlidebar=true, hand=0
    GS->>GS: threshold crossed, showslidebar (侧滑菜单 126)
    GS->>GS: read recent NOTE/DOC, enable buttons
    GS->>Apps: broadcast slidebarstatusbarstate
    GS->>WM: addWindow TYPE_PHONE overlay (SYSTEM_ALERT_WINDOW, uid 1000)
    WM-->>EL: mCurrentFocus = launcher overlay; mResumedActivity stays MainActivity
    Note over EL: eLauncher receives NO input event - cannot intercept
```

## Implications for eLauncher

- **Cannot suppress/intercept** the panel from app code; the trigger is a
  vendor system service (uid 1000). Disabling it is only possible via the
  Supernote's own slide-bar setting (`enableSlidebar`).
- **Can observe** it: register a `BroadcastReceiver` for
  `com.ratta.supernote.launcher.slidebarstatusbarstate` (mirroring the existing
  `UnlockReceiver` / `BigmeShims` pattern) to react when the panel opens/closes
  — e.g. close the app drawer or refresh the home screen.
- This reinforces the existing design note: vendor eInk launchers run gesture
  logic as privileged services independent of the home app; per-device shims
  (`BigmeShims` for HiBreak) are the established way eLauncher copes.

## Key evidence files

- `/tmp/supernote_swipe.log` — full logcat trace of one swipe.
- `/tmp/supernote_panel.png` — screenshot of the side panel over eLauncher.
