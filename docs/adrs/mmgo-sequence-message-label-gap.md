# mmgo: Widen sequence-diagram gaps to fit cross-message labels

## Problem

In a sequence diagram, three messages between adjacent participants
`L` and `V`:

```
L->>V: layout change No. 1 → cancel + reschedule (300ms)
L->>V: layout change No. 2 (>300ms gap on e-ink) → cancel + reschedule
L->>V: layout change No. 3 → cancel + reschedule
```

rendered with the labels overflowing both lifelines — the arrow
between L and V was much shorter than its label, so the label text
spilled past both vertical lines.

## Root cause

`computeLayout` in `pkg/renderer/sequence/renderer.go` set each
participant gap from only two inputs:

1. The mean of the adjacent participants' box widths.
2. A floor of `defaultParticipantGap = 150`.

It never looked at message label widths. The existing `selfMsgBleeds`
pass *did* widen the layout for self-message labels, but only at the
edges — it didn't widen any gap *between* participants for cross-
participant messages.

## Solution

Add `collectMsgLabelGap` that walks `d.Items` recursively (including
inside blocks and branches) and accumulates a per-segment minimum
width into `segLabelMin []float64`:

```go
labelW := /* widest splitLabelLines line, via EstimateWidth */
perSeg := (labelW + 2*msgLabelGap) / float64(hi-lo)
for k := lo; k < hi; k++ {
    if perSeg > segNeeds[k] { segNeeds[k] = perSeg }
}
```

Then in the `xs` build loop, `gap = max(currentGap, segLabelMin[i-1])`.
For single-span messages this widens just that one segment; for
multi-span messages the requirement is divided evenly across the
spans (over-allocates in pathological cases but never under-allocates).

`pIndex` construction moved up so it's available for the new pass and
the existing bleed/box passes — no second map.

## Key files

- `pkg/renderer/sequence/renderer.go` — `collectMsgLabelGap` helper,
  `segLabelMin` integration in `computeLayout`, `pIndex` moved up.
- `pkg/renderer/sequence/renderer_test.go` —
  `TestRenderLongMessageLabelExpandsGap` asserts that for a long-label
  cross-participant message, lifeline gap ≥ label width.
- `examples/sequence/{activations_nested,arrows,auth_flow,nested_blocks,rect_color,title_and_multiline}.{svg,png}`
  — snapshots refreshed (six diagrams whose labels happened to fit only
  because of participant-box widths).

PR: pending push to fork.

## Lessons learned

- **Layout passes that read only one source of width** (here:
  participant boxes) **silently break when a different input grows**
  (long labels). When adding a new dimension to a layout, audit which
  passes already consider the things you care about and which don't.
- **Even-distribution is a fine first pass for multi-span constraints.**
  A "compute deficit and spread evenly" rule never under-allocates and
  is dramatically simpler than a real constraint solver. Worth
  upgrading only when a real diagram demonstrates the over-allocation.
- **Snapshot tests catch unintentional layout drift, but the fix is
  almost always to refresh, not to revert** — six sequence diagrams
  changed because their labels had been narrower than their boxes by
  accident. The new layout is correct; the snapshots needed to match.
- **Keep `EstimateWidth` for layout pre-passes; `Ruler.Measure` only
  where the measured value becomes a visible dimension.** For gap
  sizing, EstimateWidth's ~20% overestimate is *useful margin*, not a
  bug — using a real ruler here would slightly under-pad some labels.
