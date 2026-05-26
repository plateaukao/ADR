# KOReader pencil.koplugin port to Sony DPT-CP1

## Summary

Bring the stylus performance of the standalone `sony_draw` app — kernel-level Direct Handwriting plus Sony's DU/GC16 EPD waveform modes — to KOReader's `pencil.koplugin` running on the Sony DPT-CP1. The work spans three repos and is recorded as two committed-but-detached SHAs plus one patch file under `~/src/sony_draw/patches/`.

## Approach

1. **Find the integration seam in KOReader's Android stack.** The launcher (`android-luajit-launcher`) already detects `SONY_CP1` in `DeviceInfo.Id` and was routing it to `NookEPDController` — which uses NTX's `View.postInvalidateDelayed(delay, x, y, w, h, mode)` reflection. Sony's modified Android framework exposes the waveform-mode hint through a different overload, `View.invalidate(Rect, int mode)` (confirmed by decompiling `/system/framework/EPDHelper.jar` from the DPT-CP1). So the existing Sony routing was wrong; the fast EPD path was a no-op.

2. **Build a Sony-specific EPDController.** New `SonyEPDController.kt` tries `View.invalidate(Rect, int)` first, falls back to NTX's `postInvalidateDelayed`, and then to plain invalidate. Waveform constants are reused from the NTX set unchanged because both chipsets are i.MX EPDC variants (DU=1, GC16 partial=2, GC16 full=34). `EPDFactory.kt` routes `SONY_CP1` to this controller.

3. **Bring DHW into the launcher.** Direct Handwriting is the kernel-fast pen path used by Sony's DigitalPaperApp — the EPD driver paints stylus strokes inside a registered allow-rect before they ever reach the Android UI thread. The C side lives in `/system/lib/libSystemUtil.so`. The .so calls `jniRegisterNativeMethods` against the exact class path `com.sony.infras.dp_libraries.systemutil.SystemUtil` (verified with `strings` on the .so), so a Java stub at that path with matching native signatures lets `JNI_OnLoad` succeed. The `.so` and stub were lifted verbatim from `sony_draw`. A reflective Kotlin wrapper (`SonyDhw.kt`) keeps the launcher buildable against stock `android.jar` and turns every method into a no-op when the loadLibrary fails (i.e. non-Sony devices).

4. **Expose DHW + tool type to Lua.** Five JNI methods (`stylusDhwAvailable`/`Enable`/`Disable`/`SetArea`/`ClearArea`) added to `LuaInterface` + `MainActivity`, mirrored on the `android` Lua table in `assets/android.lua`. Plus FFI cdefs for `AMotionEvent_getToolType`, `AMotionEvent_getButtonState`, and the matching `AMOTION_EVENT_TOOL_TYPE_*` enum.

5. **Fill in the missing tool-type plumbing in koreader-base.** `ffi/input_android.lua` was reading the position/pressure/etc. via FFI but never `AMotionEvent_getToolType`, so on Android `slot.tool` always stayed nil — meaning the pencil plugin couldn't tell stylus from finger no matter what it did in Lua. One small patch adds an `emitToolType` helper that synthesizes an `ABS_MT_TOOL_TYPE` event before the position events, translating the NDK constants to the Elan-panel convention KOReader's upstream `frontend/device/input.lua` already understands (pen=1, eraser=2). After this, `slot.tool` is populated identically to Kobo, and the plugin's `routeStylusEvents` works without modification.

6. **Plugin patch is tiny.** Just `setupSonyDhw` / `teardownSonyDhw` hooks added next to the existing `setupStylusCallback` / `teardownStylusCallback`. Gated on `Device:isAndroid() and android.stylusDhwAvailable()` so non-Sony builds are no-ops.

## Trade-offs

- **Three repos, two detached commits.** The launcher and koreader-base submodules are pinned by the koreader superproject to specific SHAs. My commits sit at detached `HEAD`s — fine for local builds, but to maintain them long-term they need either pushed forks (and superproject SHA bumps) or carried as patch files alongside the plugin's. I went with: launcher + base get local commits, plugin gets a portable `.patch` file. Trade is "easy to apply" against "tied to specific koreader SHAs."
- **Reflection over compileOnly stub jars.** Same call as in `sony_draw`: the launcher compiles against stock `android.jar` and resolves Sony's `View.invalidate(Rect, int)` overload at runtime via `getMethod`. Tiny perf cost (one resolution at startup, cached method); avoids needing Sony's modified `android.jar` to build.
- **Tool-type translation lives in koreader-base, not in the plugin.** Could have been the plugin's job — but doing it in `input_android.lua` means *any* future stylus-aware code (KOReader core, other plugins) gets it for free, not just pencil. Cost: a 22-line patch on a submodule the user doesn't otherwise maintain.
- **DHW area is registered once on plugin enable, not redrawn on rotation.** If the user rotates the device while pencil is on, the kernel allow-rect goes stale. `setupSonyDhw` would need to re-run on rotation; the plugin already has rotation hooks but I left this for follow-up. Acceptable for v1 because the DPT-CP1 is portrait-locked in practice.
- **No standalone `sony_draw.koplugin` alternative.** Considered building a parallel minimal plugin instead of porting pencil — would have avoided the input.lua replacement entirely. Rejected because pencil already has annotation grouping, undo, bookmarks, exports — features that would all need to be rebuilt. Better to fix the few Kobo assumptions than ship a parallel half-featured fork.

## Key Files

- `~/src/koreader/platform/android/luajit-launcher` @ `f744b56` — Sony EPD controller, DHW binding, Lua bridge, FFI cdefs.
- `~/src/koreader/base` @ `250ae579` — `ffi/input_android.lua`: emit ABS_MT_TOOL_TYPE from `AMotionEvent_getToolType`.
- `~/src/sony_draw/patches/pencil-sony-android.patch` — 53-line patch against `pencil.koplugin/main.lua`.
- `~/src/sony_draw/patches/README.md` — build/install steps and verification (logcat tags).
- `~/src/sony_draw/app/src/main/jniLibs/armeabi-v7a/libSystemUtil.so` — origin of the .so the launcher now bundles. Pulled from device `/system/lib/`.
