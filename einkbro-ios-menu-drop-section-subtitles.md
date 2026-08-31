2026-08-31

# EinkBro iOS: drop the section subtitle labels in the menu dialog

The browser menu grid rendered a centered caption above two of its sections —
分享或儲存 (share/save) and 網頁內容調整 (web content adjustment). With the
themed section dividers from the theming revisit (see
[einkbro-ios-theme-frame-insets-themed-dividers](einkbro-ios-theme-frame-insets-themed-dividers.md)),
the captions became redundant: the dividers already group the icons, and the
labels only added vertical noise to a dialog that is all recognizable icons
with their own captions.

The change removes just the header `Text` in `MenuDialog.kt`'s section render
loop. `MenuSection.headerRes` stays, because the hide/reorder editor
(`MenuItemHideScreen`) still uses those strings to label its sections — there
the text is doing real work, since items are being moved across section
boundaries.

Verified in the simulator: menu shows the icon grid separated only by themed
dividers, and the hide/reorder editor keeps its headers.
