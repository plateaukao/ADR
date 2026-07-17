2026-07-17

# EinkBro iOS: first settings-gap round after the parity audit

Follow-up to the same-day parity audit (`docs/SETTINGS_AUDIT.md` in
einkbro-ios): the first tranche of inert settings brought to life, committed
as `9707a4e`.

## What changed

**Save-history-on-close.** The Start Control screen offers Android's three
history modes, but iOS recorded history on page-finish regardless of
open/close choice. `SAVE_WHEN_CLOSE` now defers: page-finish stashes the
tab's latest (title, url) in a per-album map, and `closeTab` writes the
record — so only the page you left a tab on lands in history, matching
Android's `TabManager`.

**Live UI preference reaction.** Android's `BrowserActivity` registers one
`onSharedPreferenceChanged` listener that applies ~15 prefs live. The Compose
port had wired exactly one key (show-tab-bar). The listener now also reacts
to toolbar position/icons, statusbar enabled/position/items, hide-statusbar,
and FAB position by bumping the existing `toolbarRefreshTick` state — one
recomposition refreshes every composition-time config read, so those toggles
apply the moment you leave the settings screen instead of on restart. Web
-behavior keys (video autoplay, custom UA, dark mode) still apply on next
navigation; Android reloads immediately — noted as a remaining gap.

**GPT actions in the text-selection menu.** Android's selection ActionMode
menu is built from `gptActionList`; the iOS selection menu was a fixed
six-item list (copy/highlight/translate/read/search/share), so user-defined
GPT actions were unreachable from selected text. They're now appended, each
opening the GPT dialog with the selection (and its context) through
`setupGptAction` — the same plumbing the Page-AI dialog already used.

## Still open

The audit's remaining work-list lives in `docs/SETTINGS_AUDIT.md`: network
search suggestions, app-locale picker, hide-menu-items editor, scroll
auto-hide toolbar, vertical toolbar, DEEP e-ink image mode, dual captions,
PDF paper size, geolocation/autofill wiring, vi bindings, drag-URL-to-action,
and immediate-reload for the web-behavior keys.
