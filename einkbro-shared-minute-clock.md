2026-07-07

# EinkBro: single minute-aligned clock for toolbar and statusbar

Two near-identical clock composables — `CurrentTimeText` in the toolbar and
`StatusbarTime` in the statusbar — each ran
`while(true) { format(Date()); delay(60_000) }` with a fresh
`SimpleDateFormat` allocated every tick. Because the 60-second delay starts
at composition time, the displayed minute could lag the real clock by up to
59 seconds — quite visible on a device whose whole point is showing a
mostly-static screen.

Both now call a shared `rememberCurrentTimeText()`, which keeps one
formatter and sleeps to the next minute boundary
(`delay(60_000 - now % 60_000)`), so the label flips exactly when the
minute does.

Verified on the emulator: adding "Current time" to the toolbar preview
renders the current time (matching the system clock) through the shared
composable.
