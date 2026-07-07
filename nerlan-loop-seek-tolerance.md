2026-07-08

# NerLan: sentence loops seek with zero tolerance

The shadowing feature loops one `[start, end)` sentence region; its end is matched with a boundary time observer (exact), but the *seeks back to the start* used `seek(to:)` — `AVPlayer`'s default seek with unbounded tolerance, which is free to land on the nearest convenient position (up to ~1 s off, depending on the media's packet layout). Each loop pass could therefore audibly clip the sentence's first syllable or pre-roll the tail of the previous sentence — exactly what a learner repeating one sentence notices most.

Loop arming (`loopSegment`) and every repeat pass (`loopBoundaryReached`) now go through a private `seekPrecisely(to:)` using `toleranceBefore: .zero, toleranceAfter: .zero`. The scrubber and ±15 s skip buttons keep the coarse default seek — there the speed of a tolerant seek matters more than sample accuracy.
