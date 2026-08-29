2026-08-29

# CalliPlus: stock Holo icons for the character controls

## What changed

The row of round buttons under the big character, and the two animation actions in
the rule-book action bar, now use the framework's own Holo icons throughout:

| control | before | now |
|---|---|---|
| clear the writing | `ic_menu_revert` (an undo arrow) | `ic_menu_delete` |
| 筆順動畫 (button and action bar) | custom `ic_play_strokes` vectors | `ic_menu_slideshow` |
| 手寫動畫 (button and action bar) | custom `ic_play_hand` vectors | Holo pencil + Holo play clip, composed |
| running animation (action bar) | custom `ic_stop` | `ic_menu_close_clear_cancel` |

Save, prev/next and info keep the stock icons they already had; the 實/空 fill toggle
keeps its own glyph.

## Why stock, and why the tint mattered

The user's first request was to restyle the stock icons to match the custom
animation ones. Two rounds of hand-drawn and Material-path vectors later it was
clear that was backwards: the stock set is what reads as a set, and the custom icons
were the odd ones out. The reason they never quite matched is the tinting.
`ColorFilterImageButton` applies `LightingColorFilter(0x00FFFF, red)` — red channel
forced to 255, green/blue kept, alpha kept. The Holo Light menu icons are `#333` at
roughly 64% alpha, which comes out as a pale red; an opaque custom fill comes out
solid red no matter what gray it started as. Same story in the action bar with its
own tint. So the fix was to use the framework bitmaps, not to repaint vectors.

To let the user pick, a gallery of every framework `ic_*` PNG (from
`platforms/android-36/data/res/drawable-xxhdpi/`) was rendered through the same
tint into a local HTML page; `ic_menu_slideshow` and `ic_menu_edit` came out of that.

## The composed pencil-and-play icon

`drawable/ic_play_hand.xml` is a `layer-list`: `@android:drawable/ic_menu_edit`
full-size, and `ic_menu_play_clip` at 16dp in the bottom-right corner where the
pencil leaves space. `ic_menu_play_clip` exists in the framework but is not a public
resource, so its mdpi–xxhdpi PNGs are copied into the app as `holo_menu_play_clip`.
Being the framework's own bitmaps, both layers tint identically to the icons beside
them.
