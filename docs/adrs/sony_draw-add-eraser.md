# sony_draw — add eraser

## Summary

`sony_draw` now erases strokes when the user flips the stylus over and drags. No UI button: the tool is determined per-event from the stylus's reported tool type. Eraser radius is 5px (matches the felt tip width on the bundled DPT-CP1 stylus). Visual feedback is a thin black circle outline that tracks the eraser, painted in DU mode; a GC16 partial refresh cleans up on pen-up.

## Approach

1. **Per-event tool detection** instead of a sticky tool mode. On every MotionEvent we read `getToolType(idx)` plus `getButtonState()`; if either signals eraser (`TOOL_TYPE_ERASER` or `BUTTON_TERTIARY`) we route to the eraser path, otherwise the pen path. This matches what DigitalPaperApp does (`buttonState=4 → ToolMode.ERASER` in its StylusView), but without the UI toggle since the user said the physical eraser tip is the only entry point they want.

2. **Persistent stroke list.** Previously the app drew strokes into an off-screen ARGB-8888 bitmap and forgot them. Erasing needs to remove individual strokes after the fact, so finished strokes are now appended to `mStored` (the editor's `addStroke` already returns the finished-on-this-event list). `Stroke` tracks its bounding rect inline so the scan can quick-reject most strokes per eraser event.

3. **Hit test ported from Sony's `isCrossEraser`** (`StylusView.java:1163`). Three sub-tests, any of which counts as a hit:
   - any stored point inside the eraser circle (radius around the current eraser position),
   - any stroke segment intersects the eraser circle (closest-point-on-segment-to-center distance vs radius),
   - any stroke segment crosses the eraser's own prev→cur swipe (standard CCW segment-cross test).
   The third test is what catches fast eraser motion — between two MotionEvent samples the eraser circle never overlaps the stroke, but the swipe segment does.

4. **Redraw-survivors on every erase event.** Simpler than Sony's "paint white over erased + cleanup on lift" approach: when any stroke gets removed, wipe `mStrokeBitmap` with `PorterDuff.Mode.CLEAR` and call `InkStrokeEditor.renderAll(mStored, …)`. For typical stroke counts this is well under a millisecond; quick-reject via bounding-rect keeps it bounded. The dirty region passed to the EPD refresh is the union of the eraser circle position(s) and the bounding rect of the strokes that were removed, so the DU update area stays small.

5. **Eraser circle indicator** is painted by `RenderingThread.drawFrame` on top of the stroke bitmap, after it's blitted. Black stroke (1bpp DU mode is what's locking the canvas, so anti-aliasing is off anyway). `setEraserCenter(null, 0)` on pen-up before the GC16 finalize so the indicator doesn't leave a ghost.

6. **Direct Handwriting disabled during erase.** DHW is the kernel-level fast pen path — it watches the touchpanel and paints pen-color strokes directly to the framebuffer in the registered allow-area. Left on during eraser dragging, it would paint pen strokes at the eraser positions, fighting the Java redraw. Re-enabled on pen-up so the next pen-down has the low-latency path back.

## Trade-offs

- **Redraw-all vs incremental overlay.** Sony's app marks erased strokes for visual "white-over" during the drag and only finalizes the removal on lift. We just rebuild the stroke bitmap each event. Cheaper to reason about and good enough at our typical stroke counts; if the app grows annotations a page-worth of dense strokes it may be worth porting Sony's incremental approach.
- **No buttonState-based highlight tool.** DigitalPaperApp also handles `BUTTON_SECONDARY → HIGHLIGHT`. We dropped it — out of scope, and the DPT-CP1 default stylus doesn't ship with a side button mapped to it.
- **Pen polygon vs eraser-survivor polyline mismatch.** Live pen drawing uses Sony's tapered-quad-with-circles polygon. The replay path (`renderAll`) uses a simpler round-cap polyline. At 2px width these are visually identical; if pen width becomes variable per stroke we'd need to make the two paths agree exactly.
- **Per-event tool, no sticky state.** A user can't lock into eraser mode with the pen tip. That's fine here because the physical eraser end always reports `TOOL_TYPE_ERASER`, but if a future stylus model omits that, eraser would be unreachable without re-adding a UI toggle.

## Key Files

- `app/src/main/java/com/maoyuankao/sonydraw/EraseMath.java` — three-part stroke-vs-eraser hit test.
- `app/src/main/java/com/maoyuankao/sonydraw/StylusView.java` — tool routing, eraser loop, DHW lifecycle around erase.
- `app/src/main/java/com/maoyuankao/sonydraw/InkStrokeEditor.java` — new `renderAll` static for replay.
- `app/src/main/java/com/maoyuankao/sonydraw/RenderingThread.java` — eraser circle indicator overlay.
- `app/src/main/java/com/maoyuankao/sonydraw/Stroke.java` — bounding rect for quick reject.
