# calliplus_android: PaintView ANR fix

Commit: `f7a4494` — *perf: fix ANR in brush renderer by collapsing redundant subdivision*

## Problem

After the recent rewrite of `PaintView` (the ink-brush drawing surface in `CharActivity`), fast strokes on the emulator caused:

- A 35.7-second ANR (`ActivityManager: ANR in info.plateaukao.calliplus`, 2026-04-19 23:07).
- Choreographer bursts like `Skipped 143 frames!` and `Skipped 66 frames!` during active drawing.
- GC-pressure warnings: repeated `Reducing the number of considered missed Gc histogram windows from ~549 to 100` from the app process.

The UI thread was backed up to the point the input dispatcher killed it.

## Root Cause

Two compounding problems inside `PaintView.renderSegment` / `stampAlongSubSegment`:

1. **Double subdivision.** The code subdivided the centripetal Catmull-Rom curve to 1-pixel granularity (`subdiv = max(8, (int) segDist)`) *and then* walked each 1-px sub-segment a second time to decide where to stamp (`spacing = width × 0.06`). The inner walk normally produced at most one stamp per 1-px sub-segment, so the outer loop was ~17× more subdivisions than needed. Each outer step called `catmullRomCentripetal`, which recomputed four `Math.pow(Math.hypot(...), 0.5)` knots on every step — none of the knots vary within a segment.

2. **Per-touch amplification.** `brush_move` called `addFilteredSample` for every historical `MotionEvent` sample **plus** the current one, and each `addSample` ran a full `renderSegment`. A single `ACTION_MOVE` with 10 historical samples → 11 `renderSegment` calls → for a 200-px segment that's ~200 subdivisions × ~4 `Math.pow` calls = ~800 pow calls × 11 = **~8 800 pow calls per MOVE event**, plus thousands of `drawBitmap` / `Matrix` operations, at 60+ Hz touch rate. Plus `new PointF(...)` on every sample feeding the GC, and `ArrayList.remove(0)` at O(n) when the ring overflowed.

Detected via:
- `adb logcat` showed the ANR line and recent `Choreographer` skipped-frame warnings.
- Direct code read of `PaintView.java` surfaced the double-loop.

## Solution

Three-part rewrite of the hot path in `PaintView` (~80-line delta):

1. **Collapse subdivision into the stamp loop.** New subdivision count is `ceil(segDist / spacing)` where `spacing = avgWidth × SPACING_FACTOR`, capped at `MAX_STAMPS_PER_SEGMENT = 256` so an ultra-long flick can't pin the UI thread. Each step stamps exactly once — `stampAlongSubSegment` is deleted.

2. **Hoist Catmull-Rom knots.** The three `Math.pow(...)` calls and their reciprocals (`invK1K0`, `invK2K1`, `invK3K2`, `invK2K0`, `invK3K1`) are computed once per segment, not per step. `catmullRomCentripetal` is inlined into the loop to avoid the 2-element `float[] catmullOut` round-trip.

3. **Zero-allocation sample ring.** Replaced `List<PointF>` + `List<Long>` with fixed-size `float[4] ptsX / ptsY` and `long[4] ptsT`, indexed by `ptsSize`. When the buffer overflows, shift three slots left (trivial vs. `ArrayList.remove(0)`). No per-sample `new PointF`.

`CharActivity` pen-size preview now reads `paintview.getMaxStampWidthPx()` so the ink-dot icon matches the actual stamp size, instead of being sized from the raw seekbar dp value.

## Validation

On a Pixel 7 API 34 emulator with the release-style debug build:

- Fast full-canvas horizontal / vertical / diagonal swipes (the scenario that produced `Skipped 143 frames`) now draw without stalls.
- `adb shell dumpsys gfxinfo info.plateaukao.calliplus framestats` over a stroke session reported:
  - **Janky frames: 43 / ~10 000 = 0.43 %**
  - 50th %ile 19 ms, 95th %ile 21 ms (within 60 fps budget).
- `adb logcat` clean: no `Skipped frames`, no `ANR`, no GC-histogram warnings during drawing.
- Visual behavior preserved — centripetal Catmull-Rom smoothing, velocity-modulated width via smoothstep, and tapered stroke end (收筆) all render as before.

## Key Files

- `app/src/main/java/info/plateaukao/calliplus/ui/PaintView.java`
  - Rewrote `renderSegment`; deleted `stampAlongSubSegment` and the out-of-line `catmullRomCentripetal`.
  - Replaced `List<PointF>` + `List<Long>` with `float[]`/`long[]` ring + `ptsSize`.
  - New constant `MAX_STAMPS_PER_SEGMENT = 256` guards against UI-thread starvation on pathological strokes.
- `app/src/main/java/info/plateaukao/calliplus/CharActivity.java`
  - Brush preview `ImageView` is sized from `paintview.getMaxStampWidthPx()`; seekbar listener calls `setPenSize` *before* reading the preview size so the preview reflects the new size.

## Lessons Learned

- **Avoid layered "smoothing" pipelines.** Subdividing a curve to pixel resolution *and* separately walking stamp spacing within each sub-segment meant the nominal stamp count (curve length / spacing) was multiplied by `1 / SPACING_FACTOR`. A renderer of this kind should pick **one** axis of subdivision — either step along arc length and stamp every step, or step along `t` and spacing-walk, not both.
- **`Math.pow` in hot loops is a red flag**, especially when its arguments are invariant over the loop. Hoisting to once per segment can be the difference between jank and smoothness.
- **`ArrayList<Float/PointF/Long>` in a per-touch buffer is a GC trap** — autoboxing (`Long`) and per-sample `new PointF` both allocate, and `remove(0)` on a short list is still O(n) plus an arraycopy. For a fixed-size ring, primitive arrays + a size cursor cost nothing.
- **The ANR trace was unreadable on the emulator (`/data/anr` needs root)**, but `adb logcat -d | grep -iE "ANR|Skipped|Reducing.*Gc"` was enough to localize the culprit. `dumpsys gfxinfo framestats` + histogram gave quantitative before/after evidence without needing systrace.
- **Ground-truth the fix in the UI**, not just the tests: this module has no unit tests, and the pathology was latency-driven. Driving the app to `CharActivity` and measuring `framestats` under simulated fast strokes was the only way to know the fix held.
