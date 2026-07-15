# Notable: get Sony DPT-CP1 actually drawing

## Summary

The previous commit shipped the Sony product-flavor scaffold but the
APK failed to install on a real DPT-CP1 (Android 5.1 / SDK 22 →
`INSTALL_FAILED_OLDER_SDK`) and, once forced through, crashed before
reaching the editor; even when it did reach the editor, strokes either
didn't show at all or appeared briefly then vanished. This commit gets
Notable's actual editor (toolbar, page model, stroke DB, multi-page,
undo) running on a DPT-CP1 with sony_draw-grade in-stroke latency.

## Approach

### API 22 compatibility audit

Dropped Sony flavor `minSdk` from 26 back to 22 and worked through every
runtime failure surfaced by an actual launch on the device:

- **Manifest merger**: about 50 androidx / Compose AAR packages declare
  `minSdkVersion=23+` in their AAR manifests. `app/src/sony/AndroidManifest.xml`
  lists them all under `tools:overrideLibrary`. List enumerated by
  scanning `~/.gradle/caches/.../transformed/**/AndroidManifest.xml` for
  `minSdkVersion >= 23`.
- **Adaptive icons**: `mipmap-anydpi/` → `mipmap-anydpi-v26/` so the
  XML adaptive-icon resources only apply on API 26+. Pre-26 falls back
  to the PNG launcher icons already in `mipmap-{hdpi,mdpi,xhdpi,...}/`.
- **Compose insets**: `androidx.compose.ui.layout.InsetsListener` calls
  `View.getRootWindowInsets()` (API 23+) unconditionally on attach.
  Sony-flavor Gradle resolution strategy pins `androidx.compose.*` →
  `1.7.8`, before that listener existed.
- **Lifecycle / activity / navigation**: pinned to 2.8.7 / 1.8.2 /
  2.7.7 respectively — keeps `lifecycle.asFlow()`, the
  `lifecycle.compose.LocalLifecycleOwner` import path, and the
  pre-Hilt-1.3 navigation surface that Notable's main code uses.
  Explicit `sonyImplementation "androidx.lifecycle:lifecycle-runtime-compose:2.8.7"`
  because that artifact's transitive pull changes across the downgrade.
- **`@OptIn` for foundation experimental APIs**: applied as a Kotlin
  compiler arg via `tasks.withType(KotlinCompile)` because AGP 9 no
  longer accepts `kotlinOptions {}` inside the android block. No-op on
  Onyx where the same API is stable.
- **Java 8 default methods**: `Collection.removeIf` and friends are
  used throughout Notable (e.g. SnackBar collect loop); not in the API
  22 platform runtime. Added `coreLibraryDesugaring` +
  `desugar_jdk_libs:2.1.5`.
- **GLFrontBufferedRenderer**: its `<clinit>` references
  `HardwareBuffer` (API 26+). Gated `OpenGLRenderer.attachSurfaceView`
  behind `Build.VERSION.SDK_INT >= O`. Sony's DHW kernel path provides
  the low-latency in-stroke rendering anyway.

### Sony rendering pipeline (matches sony_draw)

- **`EinkDevice` gains two hooks**:
  - `lockCanvas(holder, dirty, hint)` — `FAST` → DU waveform,
    `CLEAN` → GC16 partial. Default delegates to `holder.lockCanvas(dirty)`.
  - `composeOverlay(canvas, dirty)` — called by `DrawCanvas` /
    `CanvasRefreshManager` after every page-bitmap blit. Default no-op.
- **`SonyEinkDevice`**:
  - `lockCanvas` maps `FAST` → `EinkMode.UPDATE_MODE_NOWAIT_NOCONVERT_DU_SP1_IGNORE`,
    `CLEAN` → `EinkMode.UPDATE_MODE_NOWAIT_GC16_PARTIAL_SP1_IGNORE`,
    routes through `EpdHelper.lockCanvas(holder, dirty, mode)`.
  - Registers a DHW allow-area over the full surface on
    `onSurfaceInit` / `onSurfaceChanged` (4-px pen baseline).
  - `composeOverlay` blits `SonyLiveStroke.bitmap` on top of pageBitmap.
- **`SonyPenInputHandler`**: full sony_draw per-batch render:
  - `ACTION_DOWN`: `DirectHandwriting.enable()`, wipe stroke bitmap,
    fire `onBeginStroke`.
  - Each `ACTION_MOVE` (including all historical samples in the batch):
    draws the segment as a filled tapered polygon with circular endcaps
    into the stroke bitmap, then locks the surface canvas with
    `EpdHelper + EinkMode.DU`, composites page bitmap + stroke bitmap,
    unlocks. About 120 ms per push — the "fast" feedback.
  - `ACTION_UP`: fires `onStrokePoints` so Notable's existing
    `handleDraw` → `page.addStrokes` → `page.windowedBitmap` →
    `refreshManager.refreshUi` path runs. That refresh uses
    `lockCanvas(CLEAN)` → GC16 partial — clean 16-grey replaces the
    DU pixels with Notable's renderer's stroke.
- **`SonyLiveStroke`**: process-wide holder of the active stroke
  bitmap. Kept alive **between strokes** — only cleared on the next
  `ACTION_DOWN`. So even when Notable's GC16 refresh races
  `handleDraw` and blits `page.windowedBitmap` without the new stroke,
  the overlay composes the live segments on top in the same
  lockCanvas cycle. Without this, "strokes shown then disappear" was
  the dominant failure mode.

`DrawCanvas` / `CanvasRefreshManager` surface locks now go through
`EinkDeviceProvider.current.lockCanvas` and call `composeOverlay` after
the page-bitmap blit.

## Trade-offs

- **Sony-only `overrideLibrary` is a "trust me" override**. Several of
  those libs do call API 23+ symbols at runtime; we'll only find out
  when a specific code path is hit on a DPT-CP1. So far the editor +
  library + settings screens have launched cleanly, but other Notable
  surfaces could still throw `NoSuchMethodError` deeper in.
- **Pinning Compose / Lifecycle / Activity / Navigation to older
  versions on Sony** means the Sony build runs against a code-frozen
  subset of the androidx stack. If Notable's main code starts using
  an API only present in newer Compose, Sony breaks. Mitigation:
  resolution strategy keeps Onyx on the latest, so only Sony pays.
- **Live-overlay strategy duplicates rendering**. While a stroke is
  on screen, the user sees the polygon-rendered live segments (from
  `SonyLiveStroke.bitmap`) *plus* Notable's pen-renderer version
  (drawn into `page.windowedBitmap` by `handleDraw`). They look very
  similar with the simple Sony-flavor `drawStroke`, but if Notable's
  pen rendering ever diverges visually the duplicate will become
  visible. The overlay is wiped on the next stroke, which is
  good-enough but isn't a true "commit-and-clear" handshake.
- **`lockCanvas` runs on the input thread**. sony_draw uses a
  dedicated `RenderingThread` that owns all canvas locks. We kept
  Notable's existing call-site threading. So far it hasn't caused
  contention; if perf regressions show up later, porting a proper
  rendering thread is the next layer.
- **Original Onyx APK is fully intact**. All Sony-side changes live
  in flavor-only files plus default-no-op interface methods, so the
  Onyx build behaviour is byte-identical (verified by
  `assembleOnyxDebug`).

## Key Files

**New (`app/src/sony/`)**:
- `AndroidManifest.xml` — `tools:overrideLibrary` for about 50 androidx /
  Compose packages.
- `java/com/ethran/notable/editor/eink/sony/SonyLiveStroke.kt` —
  process-wide live overlay holder.

**Modified**:
- `app/build.gradle` — `minSdk 22` for sony flavor; sony-only
  resolution strategy pinning Compose / lifecycle / activity /
  navigation / core; `coreLibraryDesugaring` +
  `desugar_jdk_libs:2.1.5`; KotlinCompile opt-in.
- `app/src/main/res/mipmap-anydpi-v26/{ic_launcher,ic_launcher_round}.xml`
  (renamed from `mipmap-anydpi/`).
- `app/src/main/java/com/ethran/notable/editor/eink/EinkDevice.kt` —
  `lockCanvas(holder, dirty, hint)`, `composeOverlay(canvas, dirty)`,
  `CanvasRefreshHint`.
- `app/src/main/java/com/ethran/notable/editor/eink/PenInputHandler.kt`
  — `onTouchEvent(event)` hook (default false; Sony returns true).
- `app/src/main/java/com/ethran/notable/editor/canvas/DrawCanvas.kt` —
  routes stylus events to `inputHandler.penHandler.onTouchEvent` first
  on Sony; surface locks via `EinkDevice.lockCanvas`; calls
  `composeOverlay` after page-bitmap blits.
- `app/src/main/java/com/ethran/notable/editor/canvas/CanvasRefreshManager.kt`
  — same lockCanvas / overlay wiring; switched from `TouchHelper?` to
  `PenInputHandler?`.
- `app/src/main/java/com/ethran/notable/editor/drawing/OpenGLRenderer.kt`
  — `attachSurfaceView` gated on API O.
- `app/src/sony/java/com/ethran/notable/editor/eink/sony/SonyEinkDevice.kt`
  — `lockCanvas` mode mapping, `composeOverlay`, DHW area registration
  on surface lifecycle.
- `app/src/sony/java/com/ethran/notable/editor/eink/sony/SonyPenInputHandler.kt`
  — full per-batch live-render loop with filled tapered polygons.

## Reference

- `~/src/sony_draw/` — the DPT-CP1 reference app whose rendering
  pattern this commit ports.
- Prior commits: `notable-eink-vendor-abstraction.md`,
  `notable-sony-product-flavor.md`.
