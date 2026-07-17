2026-07-18

# EinkBro iOS: dark mode was black-on-black for primary-tinted widgets

Committed as `b548077`.

Report: in dark mode, parts of the UI were unreadable — the reader-mode
settings' page margin and line spacing bars being the clearest case.

Root cause: the ported theme keeps Android's palette verbatim, including
`primary = Color.Black` in the DARK palette. On Android that's harmless
because the dark-sensitive dialogs (reader settings among them) are XML
views styled outside Compose. The iOS port renders everything with Compose
m2 widgets, and Slider, Switch, TextField (cursor + focus indicator), and
the progress indicators all default to `colors.primary` — black on the
black dark background.

Fix: dark `primary` is Gray with `onPrimary` Black — one theme-level line
that repairs every affected widget at once, and matches the port's
gray-on-black dark aesthetic. The light palette is untouched, and direct
`colors.primary` consumers (two low-alpha tint backgrounds) render fine
with gray. Simulator-verified in dark mode: sliders, ticks, and switch
tracks all visible in the reader settings dialog.
