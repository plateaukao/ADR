# sony_draw — port stylus drawing from Sony DigitalPaperApp

## Summary

New standalone Android app that reproduces the stylus writing canvas of the Sony DPT-CP1's built-in DigitalPaperApp. Strips away the document/viewer machinery (zoom, eraser, highlights, annotation persistence) and keeps only the ink-rendering pipeline. Builds with `./gradlew :app:assembleDebug`, installs onto the device, and is in the launcher as "Sony Draw".

## Approach

1. **Get the source.** The DigitalPaperApp APK is resources-only — the bytecode lives in a sibling OAT file (`/system/app/DigitalPaperApp/arm/DigitalPaperApp.odex`, ELF-wrapped, OAT v045). baksmali 2.5.2/2.1.3 reject v045 (it was dropped from the supported list), so deodexing went through SmaliEx `oat2dex.jar` 0.86. That needs the device's `boot.oat` to build a bootclasspath first, then extracts a clean `.dex` that jadx decompiles cleanly.

2. **Find the right code.** `adb shell dumpsys activity top` on the running app revealed the live view hierarchy: `SinglePageFragment` → `StylusView` (id `stylus_view`) + `GestureView`. The SurfaceView is in `com.sony.apps.digitalpaperapp.view.widget.StylusView` and the bytecode-renderer is `RenderingThread` in the same package. Lesson reinforced (see `feedback_no_guessing.md`): always pull the actual running activity/hierarchy before deciding which decompiled class to port.

3. **Identify the platform extensions.** Two Sony-specific platform hooks make e-ink stylus drawing fast:
   - **EPDHelper / SurfaceHolderEink.** `EPDHelper.lockCanvas(holder, mode)` cast-and-calls `((SurfaceHolderEink) holder).lockCanvas(int updateMode)` — a Sony overload that maps a SurfaceView frame to a specific EPD waveform (DU, A2, GC16, …). Constants live in `/system/framework/EPDHelper.jar → EinkMode`. Decompiled `RenderingThread` calls modes 1025 (DU), 1028 (A2), 12290/12322/16386 (GC16 variants).
   - **Direct Handwriting (DHW).** `SystemUtil.getEpdUtilInstance().setDhwState(true)` and `addDhwArea(Rect, penWidth, rotation)` register an "allow area" with the kernel framebuffer driver. Inside that rect, the driver itself renders strokes from raw touchpanel events — Android UI thread and compositor are bypassed. The Java side still sees MotionEvents so the persistent stroke can be built. JNI is in `/system/lib/libSystemUtil.so`; `strings` on the .so showed it registers natives against the exact class path `com/sony/infras/dp_libraries/systemutil/SystemUtil` via `jniRegisterNativeMethods` (i.e. RegisterNatives, not symbol-based).

4. **Decide how to talk to those extensions.** Two options: compileOnly stub jars built against Sony's modified `android.jar`, or runtime reflection. Reflection won: no custom platform jars needed, the same APK builds against stock Android SDK, and degrades gracefully on non-Sony devices (falls back to plain `lockCanvas()`). `EpdHelper.java` resolves the Sony overloads with `getMethod("lockCanvas", int.class)` once and caches. For JNI, the class **must** sit at `com.sony.infras.dp_libraries.systemutil.SystemUtil` with the original native signatures — otherwise `JNI_OnLoad`'s RegisterNatives call fails. Kept the stub minimal (only DHW methods are exercised; the other natives are declared so RegisterNatives still succeeds for them).

5. **Port the rendering pipeline.**
   - `StylusView` extends `SurfaceView`, filters touch events to `TOOL_TYPE_STYLUS`, hands them to `InkStrokeEditor`. Enables DHW + registers the view's global rect as the allow-area on `surfaceChanged`.
   - `InkStrokeEditor` is the heart of Sony's algorithm: each segment is rasterised as a tapered quad (length = old-radius → new-radius) plus a filled circle at each endpoint. This is what avoids the visible gaps that `drawLine()` produces when the pen moves faster than the stroke is wide. The polygon construction is copied verbatim from `InkStrokeEditor.drawPath`.
   - `StrokeDetector` replays `getHistoricalX/Y/Pressure` before the current sample so sub-frame batched points are not lost — same logic as Sony's `StrokeDetector.addPoint`.
   - `RenderingThread` keeps an off-screen ARGB-8888 "stroke bitmap" that the editor draws into, then locks the surface in `UPDATE_MODE_NOWAIT_NOCONVERT_DU_SP1_IGNORE` (1-bit, about 120ms) while the pen is moving, and a `UPDATE_MODE_NOWAIT_GC16_PARTIAL_SP1_IGNORE` partial refresh on pen-up so the result lands as clean 16-grey.

6. **Verify on device.** First boot logs show all three hooks working:
   ```
   I/EpdHelper: EPD reflection: lockCanvas(int)=true lockCanvas(Rect,int)=true
   I/SystemUtil: JNI_OnLoad
   I/DirectHandwriting: addDhwArea Rect(0,0-1404,1872) width=2 rot=0 id=0
   ```

## Trade-offs

- **Reflection over stub-jar compile path.** Easier setup (vanilla Android SDK works), but every EPD-mode lockCanvas pays a reflective call. Negligible for this workload (≤200 calls/sec) but a compileOnly stub built from the decompiled `EPDHelper.java` would be cleaner if the project grows.
- **Reused the exact SystemUtil package.** Means our APK ships a class at `com.sony.infras.dp_libraries.systemutil.SystemUtil` that on a Sony device shadows nothing (Sony's lives in DigitalPaperApp's own dex, not the framework). On a non-Sony device the `System.loadLibrary("SystemUtil")` will fail; caller treats that as "no DHW" and the app keeps working (just without the kernel-fast path).
- **DHW rotation hardcoded to 0.** The DPT-CP1 is portrait-locked in practice. If we ever support 90° the `registerDirectHandwriteArea()` call needs to read `Display.getRotation()` and pass `rot=1` to `addDhwArea`.
- **No annotation persistence, eraser, zoom.** Out of scope for "make stylus writing work"; the data structures (Stroke list) are there to grow into when needed. Sony's `ViewportController` and `StrokesShape` aren't ported.
- **OAT v045 deodexing tool was external.** baksmali no longer supports this Lollipop-era format, so the project depends on having `oat2dex.jar` available for re-extracting code; tools are not committed (downloads cached under `reference/tools/` and gitignored).

## Key Files

- `app/src/main/java/com/maoyuankao/sonydraw/StylusView.java` — SurfaceView, touch filtering, DHW lifecycle.
- `app/src/main/java/com/maoyuankao/sonydraw/RenderingThread.java` — DU-during-stroke / GC16-on-up.
- `app/src/main/java/com/maoyuankao/sonydraw/InkStrokeEditor.java` — tapered-quad segment renderer.
- `app/src/main/java/com/maoyuankao/sonydraw/EpdHelper.java` — reflection wrapper for `SurfaceHolderEink`.
- `app/src/main/java/com/maoyuankao/sonydraw/EinkMode.java` — verbatim waveform constants.
- `app/src/main/java/com/sony/infras/dp_libraries/systemutil/SystemUtil.java` — JNI binding (package + signatures must match the .so's RegisterNatives target).
- `app/src/main/jniLibs/armeabi-v7a/libSystemUtil.so` — pulled from device `/system/lib/`.
- `reference/` (gitignored) — decompiled DigitalPaperApp.dex sources and the tooling used to produce them.
