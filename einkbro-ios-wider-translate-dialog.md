2026-07-18

# EinkBro iOS: widen the translate / AI result popup

The popup that shows translation output and AI task results (`TranslateDialogContent`,
also the progress view for agent tasks) sized itself to its content inside a
platform-default-width `Dialog`, so on a phone it typically rendered as a narrow
column in the middle of the screen — long results wrapped early and wasted most of
the display.

Per request, the card now takes an explicit width:

- **iPhone**: nearly edge-to-edge — the host `Dialog` in `BrowserScreen` sets
  `DialogProperties(usePlatformDefaultWidth = false)` so the window spans the
  screen, and the card fills to `DialogFrame`'s existing 16dp margins.
- **iPad**: fixed `600.dp`, chosen via `ViewUnit.isTablet` (backed by
  `PlatformScreen.isWideLayout()`).

The sizing lives in `TranslateResponse`'s non-rotated branch (`fillMaxWidth()` vs
`width(600.dp)`); the rotated-screen mode keeps its fixed 400x400 layout. The shared
`DialogFrame` chrome was deliberately left untouched — other dialogs keep
wrap-content sizing.

Verified in the iPhone simulator: the AI task result dialog spans the screen with
only the 16dp frame margins on each side.
