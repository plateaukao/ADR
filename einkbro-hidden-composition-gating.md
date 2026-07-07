2026-07-07

# EinkBro: stop recomposing the hidden overview panel and statusbar

## What was broken

Two always-attached ComposeViews kept doing composition work while
invisible:

- **Overview panel** (`OverviewDialogController`): content is set once in
  `init`; `hide()` only sets `visibility = GONE`. A GONE-but-attached
  ComposeView still processes recompositions, so every `album.albumTitle`
  and `album.bitmap` write (several per page load) and every record-list
  replacement recomposed the invisible tab grid — for every open tab, for
  the app's entire lifetime. No visible ghosting (it isn't drawn), but
  continuous wasted CPU on slow e-ink SoCs.
- **Statusbar** (`StatusbarViewController`): `updatePageInfo()` fires from
  the WebView scroll listener on every scroll event and wrote the state
  unconditionally — recomposing the bar even when it is GONE or the
  PageInfo item isn't in the configured item set.

## The fix

The overview composition is gated on an `isPanelVisible` mutable state
flipped in `show()` / `openHistoryPage()` / `hide()`; when hidden the
`setContent` lambda returns immediately, leaving an empty composition that
no state write can invalidate into real work. The statusbar's
`updatePageInfo` early-returns unless the bar is VISIBLE and the PageInfo
item is configured, mirroring the guard the toolbar already had.

## Verification

Instrumented with temporary logging on the emulator: exactly one compose
pass at startup (`isPanelVisible=false`, gated empty) and one on `show()`
with full content. Screenshot confirmed the panel opens with tab rows,
focus border, and bottom action bar intact; closing and reopening works.
