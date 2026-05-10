# mmgo: Size sequence-diagram note rectangles to fit text content

## Problem

Note rectangles in mermaid sequence diagrams (`Note over X`, `Note left of`,
`Note right of`) were drawn at a fixed 120×30. Long single-line notes or
multi-line notes (using Mermaid's `<br/>` tokens) overflowed the rect — the
yellow background only covered a fraction of the text. Reproducer:

```
sequenceDiagram
    participant F
    Note over F: ViewModel emits new items;<br/>key() rebuilds grid
    Note over F: showRunnable never fires; alpha stays 0
```

Both notes rendered with text spilling well outside the rect.

## Root cause

`renderNote` in `pkg/renderer/sequence/messages.go` used hardcoded
constants `noteW = 120.0`, `noteH = 30.0` regardless of text content or
line count. The `multilineText` helper correctly stacked the lines, but
the rect underneath never grew.

A second, related issue surfaced once the rect started growing with
text: `textmeasure.EstimateWidth` is a `chars × fontSize × 0.6`
heuristic. For Go Regular at 14px the real glyph advance is closer to
`× 0.45–0.5`, so the estimate overshoots by ~20–30%. Using the estimate
as the rect width (with no extra padding) still left visibly loose
horizontal margin inside the box compared to mermaid's reference render.

## Solution

Two changes in `pkg/renderer/sequence/`:

1. **Grow the rect to fit the content.** `renderNote` now computes
   width and height from the text:

   ```go
   textW := noteTextWidth(mr.ruler, n.Text, mr.fontSize)
   h := noteHeight(n.Text, mr.fontSize)
   w := math.Max(noteW, textW + 2*notePad)
   ```

   `noteHeight` adds `(lineCount-1) * labelLineHeight` for `<br/>`-split
   text. `Note over A,B` still expands at minimum to span the
   participant gap when wider than the text. `noteBleed` (called from
   `computeLayout`) mirrors the same width formula so left/right notes
   on edge participants don't clip the viewBox.

2. **Use real font metrics.** `Render` now constructs a
   `textmeasure.Ruler` (Go Regular by default), threads it through
   `computeLayout` → `noteBleed` and `newMessageRenderer` →
   `renderNote`. `noteTextWidth` prefers `Ruler.Measure` over
   `EstimateWidth`, with a graceful fallback when ruler creation fails.

For `Note over V: showRunnable never fires; alpha stays 0`:

| | Width | Height |
|---|---|---|
| Before fix             | 120 (text overflows) | 30 |
| Fix v1 (estimate, +0)  | 327.6 (loose padding) | 30 |
| Fix v2 (ruler, +8 pad) | 270.1 (text 254 + 8 each side) | 30 |

## Key files

- `pkg/renderer/sequence/messages.go` — `renderNote`, new
  `noteTextWidth(ruler,…)` and `noteHeight(…)` helpers, `messageRenderer`
  gains a `ruler` field.
- `pkg/renderer/sequence/renderer.go` — `Render` instantiates the
  ruler; `computeLayout` and `noteBleed` accept it.
- `pkg/renderer/sequence/renderer_test.go` —
  `TestRenderNoteSizesToContent` covers both multi-line and long
  single-line cases.
- `examples/sequence/notes.{svg,png}` — snapshot refreshed.

PR: https://github.com/julianshen/mmgo/pull/216

## Lessons learned

- **Don't trust a heuristic that's been "good enough" elsewhere when
  you remove the surrounding padding.** `EstimateWidth` is fine for
  participant boxes because they wrap text in `+ 2*defaultBoxPadX = 30px`
  of padding, which absorbs the overestimate. The first cut at this fix
  used `EstimateWidth` as the rect width directly — visually that's the
  *overestimate as padding*, which looks worse than mermaid because
  there's no compensating constant.
- **Prefer real `Ruler.Measure` for any code path where the measured
  value becomes a visible dimension** (rect width hugging text). Use
  `EstimateWidth` only for layout pre-passes where a small overestimate
  is acceptable slack.
- **Iterate visually, not just on snapshots.** Three rounds of "shrink
  the padding" produced 8px → 4px → 0px before I realized the
  measurement itself was wrong. A 4px reduction is invisible at typical
  viewing zoom; switching to real metrics dropped the rect by 20% in
  one shot.
- **Test rect-extraction regexes need to match negative SVG
  coordinates.** Centered `Note over A` rects can render at negative x
  on small participant grids; my first regex used `[\d.]+` and silently
  matched zero rects.
