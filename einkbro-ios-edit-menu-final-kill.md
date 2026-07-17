2026-07-17

# EinkBro iOS: killing the last system edit-menu item, live web-pref reloads

Committed as `3b541e1`.

## "Copy Link with Highlight" would not die

The earlier `canPerformAction` override suppressed the classic edit-menu
actions on text selection, but iOS 17+'s "Copy Link with Highlight" pill kept
appearing. Root cause: WebKit's content view injects it through the
`UIMenuBuilder` build path, which never consults `canPerformAction`, under a
private menu identifier — so removing guessed identifiers
(`WKMenuItemIdentifierCopyLinkWithHighlight` and the public `UIMenu*`
constants) missed it.

The fix stops guessing: `buildMenuWithBuilder` asks the builder for the root
menu (`UIMenuRoot`), walks its children, and removes every child menu except
`UIMenuStandardEdit`. Standard-edit stays so paste keeps working in editable
fields — its cut/copy actions are already refused by `canPerformAction`.
Whatever WebKit names its injected menus, they're children of root and get
swept. Simulator-verified: selection now shows only EinkBro's custom menu.

Two Kotlin/Native lessons from this file: ObjC-subclass companions cannot
hold fields (move constants to top level), and responder-chain menu building
runs ancestors after the first responder, so a WKWebView-level sweep sees
everything the content view added.

## Web prefs now reload like Android

Android's pref listener reloads the active page when desktop mode, video
autoplay, custom UA, or dark mode change; the port applied them only on the
next navigation. The BrowserScreen listener now calls `reapplyWebConfig()` +
`reload()` on those keys.
