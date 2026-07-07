2026-07-07

# NerLan: FlowLayout measures its chips once per layout pass

The language-chip `FlowLayout` used `Cache = ()` and re-measured subviews everywhere: its `sizeThatFits` computed rows (one `sizeThatFits` per chip), `placeSubviews` recomputed the same rows (another per chip), and then the placement loop measured each chip a third time. SwiftUI's `Layout` protocol has a cache mechanism for exactly this.

The layout now stores `subviews.map { $0.sizeThatFits(.unspecified) }` in `makeCache` (the default `updateCache` rebuilds it whenever the chip set changes) and both passes plus the placement loop read from it — each chip is measured exactly once per pass. Row computation was refactored to take the sizes array, which also makes it a pure function of measurements.
