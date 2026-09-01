2026-09-01

# EinkBro Android: themed toolbar edge border and load-progress line

Android port of the iOS-first design (see
einkbro-ios-themed-toolbar-edge-border.md for the full rationale and the
three iterations that led to the "true border" semantics: accent edge line in
the selected border style, theme background filled on the toolbar side,
transparent on the page side, stamp bites / sketch wobble die-cut so the page
shows through — matching the dialog frames).

## What changed

- **`contentSeparator` reborn.** The plain 1px DKGRAY `View` above the app
  bar becomes `ThemedEdgeBorderView`, a 5dp band constrained flush against
  the app bar so it overlaps the content edge (ConstraintLayout lets it sit
  over the WebView, which is what makes the transparent side show the page).
  `ViewUnit`'s appbar movers set the edge direction: bottom toolbar puts the
  edge line at the band's top, top toolbar at its bottom; left/right rails
  keep it GONE as before. Because the border lives outside the compose
  toolbar, `ComposedToolbar` itself is untouched.
- **Both progress bars are `CenterExpandProgressBar`.** The classic XML
  `ProgressBar` (horizontal) is replaced by the same custom view with a new
  `Anchor.START` mode, so both bars share one themed renderer: the separator
  pattern (dots/dashes/wobble/double rule) in the theme accent, revealed by
  clipping to the load fraction — dashes don't march. The vertical rail bar
  keeps its center-out expand, and grew from 2dp to 4dp so the patterns fit.
  The horizontal bar is inset past the border band so the two lines never
  overlap (they'd be pattern-identical and the progress would vanish).
- `ThemedBorders` exposes `accentArgb`/`baseArgb` for plain-View drawing;
  dark-mode forcing switches from `progressTintMode = LIGHTEN` to a
  fill-color override on the view.

The dialog side needed nothing on Android: the frame drawables
(StampDrawable, SketchDrawable, sticker layers) already fill inside their own
paths and report `TRANSLUCENT`, so window frames were transparent outside the
border all along.
