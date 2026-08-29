2026-08-29

# CalliPlus: Boox stylus inking without the Onyx SDK

CalliPlus now supports firmware-inked handwriting (手寫 / 描紅) on Boox e-ink tablets the
same way it already did on Supernote — and it does so **without importing
`com.onyx.android.sdk:onyxsdk-pen`**. Commits `a529c4b` and `70fba3c` on `calliplus_android`.
The SDK itself is dissected in the companion ADR
[calliplus-android-onyx-pen-sdk-analysis](calliplus-android-onyx-pen-sdk-analysis.md).

## What the user gets

- On a Boox, the pen icon in the header of both charbook screens (間架九十二法 / 心經 rule
  blocks, and the calligraphy sample grid) turns on gray "tracing" mode and hands the grid
  to the stylus. The firmware inks the strokes with sub-frame latency; the app never
  renders them. Ink is confined to the grid — nothing lands on the header.
- The trashcan (清除手寫) appears only while the pen is on and wipes the strokes.
- Settings gains a 手寫筆 category with 筆畫粗細 (1–30 px) — the Boox stroke width.
  It is hidden on devices without a firmware pen.
- Boox gets the same two-column grid layouts as Supernote (both are 10" tablets).
- In the two-pane screens the character pane's practice square is firmware-inked
  whenever the pane is showing, pen icon or not: its software `PaintView` was unusably
  slow in Boox's Regal refresh mode. The stylus goes to the firmware only; finger drawing
  stays the app's own; the pane's slider sets the firmware width there; 清除 / prev / next
  wipe the overlay too.
- Small extras that came out of testing on the device: the settings screen has an Up
  button, and `IntListPreference` no longer shows "null" above "目前設定" when a
  preference has no summary of its own.

## Why not the SDK

`onyxsdk-pen` weighs 1.8 MB and drags in onyxsdk-base/device, RxJava, fst, EventBus 3,
mmkv, retrofit, joda-time and more. Decompiling it showed that every pen call ends up in
the hidden framework class `android.onyx.ViewUpdateHelper`, whose methods are one-line
wrappers around `ServiceManager.getService("SurfaceFlinger").transact(code, parcel)` with
Onyx-private transaction codes. That is *exactly* the shape of CalliPlus's existing
`SupernoteInk` (raw Binder to the Supernote daemon), so a `BooxInk` twin of ~150 lines
replaces the whole dependency.

Doing it raw has a second benefit: `android.onyx.*` is hidden-API **blocked** for our
targetSdk (verified: `getMethod` throws `NoSuchMethodException` on the Tab Ultra C, which is
why Onyx's own demo ships `org.lsposed.hiddenapibypass`). Only `ServiceManager.getService`
is touched via reflection, and that is greylisted and works.

## How it is wired

```mermaid
flowchart TB
    subgraph app["CalliPlus (no Onyx SDK)"]
        BA["BaseActivity\npen lifecycle, penRegionView"]
        BI["boox/BooxInk\nraw Binder transact()"]
        SI["supernote/SupernoteInk\nraw Binder transact()"]
    end
    subgraph boox["Boox firmware"]
        SF["SurfaceFlinger\ntoken android.ui.ISurfaceComposer"]
        EPD["e-ink overlay\n(strokes drawn by firmware)"]
        WACOM["/dev/input/event3\nonyx_emp_Wacom I2C Digitizer"]
    end
    BA -->|isAvailable / start / setRegion / pause / stop| BI
    BA -->|setPen / setDisableAreas / clearAll| SI
    BI -->|SET_PEN_STATE, SET_REGION_LIMIT,\nSET_STROKE_WIDTH, ENABLE_POST| SF
    WACOM --> SF
    SF --> EPD
    SI -.->|service_myservice| SNFW["Supernote daemon"]
```

- `boox/BooxInk` — `isBoox()` (build identity, for layout/menu decisions), `isAvailable()`
  (Boox **and** SurfaceFlinger answers `GET_MAX_TOUCH_PRESSURE` — the transaction codes
  are non-final firmware statics, so a firmware that renumbers them simply gets no pen;
  only a positive probe is cached), `start(width)`, `resume(width)`, `setRegion(rects)`,
  `setStrokeWidth`, `pause()`, `clearRegion(rect)`, `settleAfterClear()`, `stop()`.
- `BaseActivity` — the pen lifecycle now covers both devices behind `hasPen`. New
  `penRegionView`: subclasses point it at the grid, and on Boox its on-screen rectangle
  becomes the firmware's region limit; with the pane showing, the practice square's
  rectangle is added (`booxRegions()`), and `CharPanel.onShowingChanged` /
  `onPenSizeChanged` plus `PaintView.setOnClearListener` keep the pen in step. `isPenDevice()` (Supernote ∨ Boox) gates the
  pen/clear actions, the 2-column grids and the settings category. The existing
  `dispatchTouchEvent` stylus/palm filtering carries over unchanged — stylus MotionEvents
  still reach the app while the firmware inks.
- `CharBookActivity` — 手寫 now also fades the samples (previously fading was a separate
  淡墨 toggle there; 描紅 in the rule-block screen already combined the two). Menu titles
  are derived in `onPrepareOptionsMenu` so both items stay in sync.
- `MyPreferenceManager.PREF_PEN_WIDTH` + `settings.xml` category `pref_stylus_category`
  (removed at runtime by `MyPrefActivity` off pen devices).

```mermaid
sequenceDiagram
    participant U as User
    participant A as BaseActivity
    participant B as BooxInk
    participant SF as SurfaceFlinger
    U->>A: tap pen icon, or the pane opens
    A->>B: start(width) / resume(width)
    B->>SF: SET_PEN_STATE(1), style, color, SET_STROKE_WIDTH, SET_PEN_STATE(2)
    A->>B: setRegion(grid rect and/or practice square)
    B->>SF: SET_REGION_LIMIT
    Note over SF: strokes inside the regions are inked by the firmware
    U->>A: tap trashcan / pane clear
    Note over A: wait 300 ms (600 in the pane) so the button's own repaint has landed
    A->>B: pause()
    B->>SF: SET_PEN_STATE(3)
    A->>B: clearRegion(rect) per region
    B->>SF: REFRESH_SCREEN(rect, HAND_WRITING_REPAINT_MODE)
    A->>B: resume(width) + setRegion
    B->>SF: SET_PEN_STATE(2), SET_REGION_LIMIT
    A->>B: settleAfterClear()
    B->>SF: REPAINT_EVERY_THING(GU)
    Note over SF: any app frame within ~100 ms of this still flashes
    U->>A: leave screen
    A->>B: stop()
    B->>SF: ENABLE_POST(1), SET_PEN_STATE(0)
```

## Things learned on the device

- **Style resets width.** The first build sent width before style and the 筆畫粗細
  setting had no effect: selecting a stroke style loads that style's default width, so
  the order must be style → width. The SDK demo does the same.
- **Probe.** `IS_PEN_STATE_VALID` is per-process and answers 0 until the app has a
  window; probing it in `MainActivity.onContentChanged` cached "unsupported" for the
  whole process and silently disabled everything. `GET_MAX_TOUCH_PRESSURE` (a device
  constant) is the probe now.
- **Clearing without a flash.** Any app frame posted while the pen is paused — or within
  ~100 ms after a pause/resume cycle — gets a full, flashing refresh from SurfaceFlinger.
  Found by tapping zones in a throwaway app: `PEN_PAUSE` → `REFRESH_SCREEN(region,
  HAND_WRITING_REPAINT_MODE)` → `PEN_DRAWING` → `REPAINT_EVERY_THING(GU)` erases the ink
  quietly, and a frame 100–200 ms later is fine, but a frame at 0 ms flashes. The clear
  is therefore deferred 300 ms past the tap (600 ms in the pane) so the button's own
  un-press repaint lands first. Quiet for the grid trashcan.
- **The pane still flashes** on 清除 / prev / next in Regal mode (open). The EPD log
  (`SDM update_to_display`) showed the app emitting partial updates every ~35 ms —
  `CalliImageView`'s 400 ms crossfade — after which the panel forces a full refresh
  (`HWEpdcManager: AF 30`, "auto full after 30 partials"). The crossfade is now skipped
  on e-ink, but the pane's own repaints on those actions still trip the flash; the SDK
  avoids it by tagging the app's *frame* with `HAND_WRITING_REPAINT_MODE` through hidden
  `View`/`Surface` methods, which needs a hidden-API exemption. Left for another day.
- **Width units.** The SDK's default is 7.2 px; its demo converts millimetres with
  `mm × dpi / 25.4`, so 30 px ≈ 2.5 mm on the Tab Ultra C. 80 was tried and was far too
  much once the grids went two-column.
- `screencap` does not capture the firmware overlay (same as Supernote), so verification
  is by eye on the device; the CLAUDE.md note says as much.

## Caveats

- Transaction codes were read from firmware `D60_SMT_V02_2022_0309` (Android 11). They
  are `public static int` in the framework, i.e. Onyx may renumber them. `isAvailable()`'s
  probe is the guard; re-verify on a newer-firmware Boox when one is available.
- The Supernote stroke size (`sizeEmr`) is a different unit and was left untouched; the
  new setting only affects Boox.
- On Boox, stylus strokes over the practice square are no longer in the `PaintView`
  bitmap, so "save handwriting" there only contains finger strokes.
