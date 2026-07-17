2026-07-17

# EinkBro iOS: hide/reorder-menu-items editor, quieter toasts

Committed as `d6d38c0` on einkbro-ios.

## The editor was the missing half of an already-working feature

`MenuDialog` (ported earlier) already honors `ui.hiddenMenuItems` and
`ui.menuItemOrder` — the prefs just had no editor on iOS, so the Appearance
row was a toast stub. All of the supporting machinery from Android's
`MenuItemHideActivity` had come along with the menu port
(`MenuHideConfig`/`LocalMenuHideConfig`, `MenuItemForType`,
`effectiveMenuEntries`, display/underlying order mapping, `encodeMenuEntries`);
only the screen itself was missing. `MenuItemHideScreen` is a near-verbatim
port: tap an item to toggle hidden (grayed), switch to reorder mode to
long-press-drag items across section boundaries, persisting on every change.
Simulator-verified: grid renders with section headers, tap grays an item out.

The screen slots into `BrowserScreen` like the toolbar/statusbar editors, via
a new `onOpenMenuItemHide` dep. One porting scar worth remembering:
`SettingScreenDeps` is constructed with positional arguments in
`SettingActivity`, so new callbacks must be appended at the end of the data
class, not inserted in the middle.

## Toast polish

Fullscreen toggling no longer announces itself with a toast, and the global
toast duration dropped from 2.2 s to 2 s — both direct user requests in
keeping with the quiet e-ink UX.
