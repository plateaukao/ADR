2026-07-07

# EinkBro: highlights export used a string-resource ID as the article ID

## What was broken

Exporting highlights from a single article's screen always produced
empty/wrong output. `HighlightsRoute` — the nav-route enum — declared its
screen *title* resource in a field misleadingly named `articleId`, and
`exportHighlights()` passed `highlightsRoute.articleId` (a about 2-billion
`R.string` constant) to `dumpSingleArticleHighlights(articleId: Int)`,
which expects a Room database ID. No article ever matches, so the dump was
empty. The real article ID only exists in the nav backstack arguments
(`RouteHighlights/{articleId}`) and was never captured for export.

## The fix

The export button's click handler now reads the article ID from the current
backstack entry's arguments and threads it through `showFileChooser` into
the export call. The enum field is renamed to `titleResId` so the type
confusion can't silently recur.

## Verification

Debug build on emulator: the Highlights screen opens and renders its title
through the renamed field; project compiles cleanly. (Full export requires
seeded highlight data; the ID capture is a direct read of the same nav
argument the highlights screen itself uses at
`HighlightsActivity.kt`'s `RouteHighlights` composable.)
