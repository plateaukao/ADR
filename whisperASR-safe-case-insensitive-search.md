2026-07-08

# WhisperASR: search transcripts case-insensitively on the original string

The transcript search highlighter computed match ranges on `text.lowercased()` and then sliced the *original* string with them. `String.Index` values are only valid for the string that produced them, and lowercasing can change a string's length — Turkish dotted `İ` lowercases to `i` plus a combining dot, so from that point on every index in the lowered copy is shifted relative to the original. Best case the highlights land on the wrong characters; worst case slicing past the end traps.

Both `recomputeMatches()` (which counts matches and assigns match indices) and `highlightedText()` (which styles them) now search the original string with `range(of:options:.caseInsensitive)`. Beyond removing the cross-string index hazard, this keeps the two functions on the same matching algorithm — previously one used simple `lowercased()` comparison and the other did too, but any future divergence (e.g. proper case folding vs naive lowercase) would have desynchronized the "current match" index from what actually got highlighted. Now there is one algorithm in both places by construction.
