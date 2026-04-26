# calliplus_android — Remove swollen bulb at end of na stroke

## Problem

When the user drew a na (捺, right-falling) calligraphy stroke, the rendered
shape ended with a round, almost-circular "swollen bulb" before the chisel
tail extended out — a bulb-on-a-stick look. The expected shape is a smooth
press-swell that tapers cleanly into an asymmetric chisel tip.

## Root Cause

`PaintView.renderSegment` switched stamping modes once `progress >= 0.64`:
below that threshold it used the round `stampAt` brush; above it called
`stampNaFootprint`, which drew oval stamps via `stampOval`. The footprint
oval's `crossFactor` ranged 0.74–0.96 — almost circular — so each stamp
contributed a wide vertical bulge. As stamps accumulated near the press
phase the bulges merged into a single round bulb. `renderNaTail` then drew
a thin chisel beyond it, producing the bulb-on-a-stick artifact.

## Solution

Drop the oval-footprint pass entirely. Use `stampAt` for the whole na body.
The press swell is still produced by `getNaWidthFactor` (peaks at 1.12× at
mid-stroke) and the narrowing-toward-the-tail by `closingPhase` /
`releasePhase` width lerps. The asymmetric chisel tip is unchanged: still
drawn by `renderNaTail` at brush-up, anchored at the point where
`releasePhase` first triggered.

Also removed the now-dead `stampNaFootprint`, `stampOval`,
`NA_OVAL_START_PROGRESS`, the `stampRect` field, and the `RectF` import.

## Key Files

- `app/src/main/java/info/plateaukao/calliplus/ui/PaintView.java`
  - `renderSegment`: na branch now always falls through to `stampAt`.
  - Removed `stampNaFootprint(...)` and `stampOval(...)`.
  - Removed `NA_OVAL_START_PROGRESS` constant, `stampRect` field, `RectF` import.

## Lessons Learned

- When two rendering passes are layered (oval body + path tail), the
  transition between them is the most likely place for visual artifacts —
  a bulge at the seam reads as a deliberate bulb to the user even if each
  pass looks fine in isolation.
- For brush-style strokes, a single uniform stamping primitive (round
  brush bitmap) with width modulation is usually more visually coherent
  than mixing primitives mid-stroke. The press swell can be expressed via
  width alone if the brush bitmap already has a soft edge.
- Trust pen-up time for sharp tip geometry — it's the only moment we know
  the stroke is finished, so it's the right place to draw a one-shot
  asymmetric path tip rather than trying to shape stamps mid-stroke.
