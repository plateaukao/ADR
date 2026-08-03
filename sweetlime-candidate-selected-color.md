2026-08-03

# First candidate unreadable with dark skin palettes

With a `.cskin` skin in dark mode, the auto-selected first candidate drew
black text on a black pill — unreadable while composing in a custom IM or
typing English suggestions.

## Root cause

`CandidateView.doDraw()` paints the selected candidate's pill with the
skin's `candidateSelectedBg`, but the text with `candidateUnselectedText`.
Skin designers pair the pill with `candidateSelectedText` (the 蝦米 skin's
dark palette: pill `#1A1A1A`, selected text `#FFFFFF`, unselected text
`#1A1A1A`) — so pill and text were both near-black.

The mismatch is a leftover: commit `8661589` (long before skins existed)
deliberately switched the selected candidate of normal match records to
the plain text color because it read better against the stock themes'
light highlight drawable. The skin work later routed `candidateSelectedText`
into `mColorNormalTextHighlight` but this branch never used it. The
related-phrase branch and `CandidateExpandedView` already used the
highlight color and were fine.

## Fix

When a skin is active the selected candidate now uses
`candidateSelectedText`; without a skin the stock-theme behavior from
`8661589` is preserved. Verified on the emulator in dark mode with
identical before/after states (English suggestions for "rh"): the first
cell went from black-on-black to white-on-dark. Shipped in v7.3.1
together with the wide-key touch fix (see sweetlime-wide-key-touch-grid).
