2026-09-01

# EinkBro Android: bookmarks dialog overflow and sticky window size

Opening the bookmarks dialog shifted its content down and pushed the bottom
action bar (close / sort / grid icons) under the themed frame; entering a
folder then left the huge window at its old size with the content
top-aligned in an empty frame.

## Root cause

The dialog panel had no height bound. At the root folder the bookmark grid
measured at full content height, so grid + separator + action bar exceeded
the screen. This had always been latent, but stayed invisible until the
themed dialog frames started reporting the border as window padding — the
"window grows instead of cropping content" behavior from the non-cropping
frames commit, plus the later per-style breathing room. That growth pushed
the one dialog already at screen height past it: the bar fell outside the
visible window, and the oversized wrap-content window then never re-measured
smaller when folder navigation shrank the content.

## Fix

`DialogPanel` caps itself to the usable screen height
(`heightIn(max = screenHeightDp - 120dp)`). The weighted grid now shrinks
and scrolls, the action bar always fits inside the frame, and with content
back under the bound the window tracks size again when entering/leaving
folders (verified on the emulator: requested window height dropped from the
2264px clamp to 1913px inside a folder).

Related same-day cleanups in both apps: the bookmark-edit dialog rendered an
inner material AlertDialog — a second dialog window whose default chrome
(opaque surface + hand-drawn 1dp border) covered the themed window frame on
Android and doubled the border on iOS. It now renders straight into the
themed window (Android) / relies on the themed NoDimAlertDialog frame (iOS),
and iOS's `getBookmarkFolderName()` stub was implemented with the real
text-input prompt so "new bookmark folder" works.
