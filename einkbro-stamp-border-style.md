2026-08-28

# EinkBro: postage-stamp border style

A new entry in the theme Style set: a stamp-like frame whose edges carry
evenly spaced semicircular perforation bites, like a torn postage stamp. It
joins the existing looks (Classic, Round, Sharp, Paper, Dashed, No border,
three Gradients) and follows the same architecture — one Compose shape for
in-content borders and one drawable for dialog window frames, both reading
the live theme state.

## How it's built

- `stampShape()` (Compose `Shape`) builds the perforated outline as a path:
  straight segments alternating with 180-degree concave arcs. It drives
  `Modifier.border` for in-content items and the picker's preview chip.
- `StampDrawable` draws the same path with fill plus stroke for dialog
  window frames, and the frame's content padding accounts for the bite
  depth so dialog content never overlaps the scallops.
- The picker chip for this style is visual-only: style chips no longer show
  names, so the entry carries no title string at all (titleResId 0) and no
  translations were added.

## Tuning that came out of review

Two rounds of feedback shaped the geometry:

- **Square corners with long straight runs.** Bites keep a margin of three
  bite radii from each corner, so every corner region is a plain straight
  vertical/horizontal segment rather than a curl.
- **Finer perforation on phones.** The bite radius was reduced from 6dp to
  4dp — the larger curls read as decoration overwhelming the content on a
  phone-sized dialog, while 4dp reads as texture.
