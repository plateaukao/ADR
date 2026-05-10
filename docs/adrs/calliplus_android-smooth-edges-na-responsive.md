# calliplus_android — Smooth normal stroke edges, leave na strokes responsive

## Problem

Two earlier commits (`8b9cf6f` na closing renderer, `7eb3374` smoothness) had
been working together but produced bad results in combination — round-bulb
ends on na strokes (image #1), blunt rounded caps on normal strokes (image
#3), and an unsharp tip on swift pull-offs. After several rollback /
re-apply cycles the user wanted: smoother edges on normal strokes, but no
smoothing on na strokes (so the press swell stays visible), and none of the
oval / closing-phase / release-tail rendering that the original na
enhancement layered on.

## Root Cause

- The smoothing filter (`WIDTH_FILTER_WEIGHT 0.16`) is great for normal
  strokes — it kills mid-stroke jitter — but it mutes na's characteristic
  velocity-driven press swell. Na needs a more responsive width filter to
  show the brush-pressing-down feel.
- The previous na enhancement also added oval body footprints, closing /
  release phases, and a tail path. The oval body produced the round bulb
  artifact; the tail logic was speculative tuning. None of that was
  necessary to differentiate na from normal — only the detection was.

## Solution

Gate the smoothness on stroke profile, keep only the detection needed to
gate it, drop everything else from the previous na work.

- Restored `StrokeProfile` enum, `strokeStartX/Y`, `strokeTravelDistance`
  tracking, and `resolveStrokeProfile` helper (centripetal-direction +
  straightness + diagonal-balance confidence score, threshold 0.70).
- In `renderSegment`, when `profile == RIGHT_FALLING_NA`:
  - Width range: `MIN_WIDTH_FACTOR 0.45` / `MAX_WIDTH_FACTOR 1.35`
    (original wide range — preserves swell).
  - Filter weight: `NA_WIDTH_FILTER_WEIGHT 0.35` (responsive).
  - No deadband.
  - Spacing multiplier: 1.0.
- Otherwise:
  - Width range: `STROKE_MIN_WIDTH_FACTOR 0.58` /
    `STROKE_MAX_WIDTH_FACTOR 1.12` (narrower → uniform-looking edge).
  - Filter weight: `WIDTH_FILTER_WEIGHT 0.16` (smoother).
  - `WIDTH_DEADBAND_PX 0.9` to snap sub-pixel changes to the previous width.
  - `SPACING_MULTIPLIER 0.86` for denser stamping.
- `getMaxStampWidthPx()` and `brush_start`'s initial stamp still use
  `MAX_WIDTH_FACTOR` so the preview size and brush-down stamp don't change.
- Removed: oval `stampNaFootprint` / `stampOval`, `renderNaTail`,
  closing/release phase logic, tail path field, trace logging, all the
  `NA_*` shape constants, the `Path` and `RectF` imports, the `naRelease*`
  state, `strokeId`, the `setStyle(FILL)` call, and the `tailPath` field.

## Key Files

- `app/src/main/java/info/plateaukao/calliplus/ui/PaintView.java`
  - Constants section: replaced `DEFAULT_*` naming with
    `STROKE_*` + a sibling `NA_WIDTH_FILTER_WEIGHT` and a top-level
    `WIDTH_DEADBAND_PX` / `SPACING_MULTIPLIER`. Dropped all `NA_*` shape
    constants.
  - `brush_start`: initializes `strokeStartX/Y`, `strokeTravelDistance`,
    `strokeProfile = DEFAULT`.
  - `addSample`: accumulates `strokeTravelDistance` between accepted
    samples.
  - `renderSegment`: branches on `resolveStrokeProfile(...)`; na keeps
    original parameters, default uses smoothing.
  - New helpers: `resolveStrokeProfile(...)`, `clamp01(...)`.

## Lessons Learned

- A "smooth everywhere" filter is the wrong shape for calligraphy because
  some strokes need the velocity-driven width swell as part of their
  identity. Per-stroke-class parameter selection is the right axis to vary
  on, not a global tuning knob.
- When several earlier rendering experiments produced bad results in
  combination, the right move is to strip down to the minimum needed
  (detection-only) and add back rendering one piece at a time with the
  user looking at it, instead of speculatively reshaping the tail / oval /
  closing logic in one go.
- Keep public-surface constants (`getMaxStampWidthPx`, `brush_start`'s
  initial stamp) anchored to the original values — only vary the in-stroke
  modulation. That way changes to per-stroke smoothness don't ripple into
  preview sizing or initial-touch feel.
