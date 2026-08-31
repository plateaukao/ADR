2026-08-31

# EinkBro: themed dividers and breathing room in dialogs

The theme system styles dialog frames, panels, and item borders per the chosen
border style (classic, dashed, paper, stamp, sketch, certificate, ...), but
every divider in the app was still a plain 1dp accent line. A dialog with a
dashed or scalloped frame had generic separators inside it — the frame and the
dividers didn't speak the same visual language. Labels could also sit right
against the frame border in tighter dialogs.

## Dividers follow the border style

`HorizontalSeparator` / `VerticalSeparator` (ComposeDialogFragment.kt) now draw
per `UiThemeState.uiBorder`:

| Border | Divider |
| --- | --- |
| Dashed | dashed line, same 5dp/4dp rhythm as the frame stroke |
| Paper | double 1dp lines |
| Certificate | 2dp line plus a hairline, like the frame's thick+thin pair |
| Stamp | perforation row - round dots echoing the frame's bite holes |
| Sketch | short-segment wobble with a deterministic jitter (no shimmer on recomposition), same idea as `sketchShape` |
| None / Classic / Round / Sharp / Sticker | solid line at the border's stroke weight |

The drawing is a single `DrawScope` helper shared by both orientations, so the
vertical separators used in the TTS panel and toolbar-config dialog get the
same treatment. The remaining raw `Divider(...)` call sites — bookmarks
footer, fast-toggle, task menu, translate panel, eTTS voice list, and the
user-script / highlights / saved-pages / GPT-query / menu-hide screens — were
converted to `HorizontalSeparator`, so list rows and dialog sections all pick
up the themed look, and any future border style only needs one switch branch.

## Breathing room

`ThemedBorders.contentPad` — the padding a dialog window reports around its
content so the frame never crops it — gains a 4dp base "breathing" term on top
of the border-specific extras. Every themed dialog window (Compose fragments
and the View-based DialogManager dialogs alike, via `windowPanel` /
`dialogFrame`) grows slightly instead of letting text touch the border.
Width-capped dialogs stay safe: context-menu cells already shrink adaptively
to the available width, so the extra padding cannot push actions off-screen.

## Verification

Unit test + lint gate pass. On an emulator, the main menu dialog was
screenshotted under paper, dashed, stamp, sketch, and certificate borders by
flipping the `sp_ui_border` preference: in each, the section separators match
the frame style and the content keeps clear of the border.
