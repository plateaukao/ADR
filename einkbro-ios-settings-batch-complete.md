2026-07-17

# EinkBro iOS: settings-audit batch complete

Two commits (`94968c1`, `613379c`) close out the settings-parity work-list
from `docs/SETTINGS_AUDIT.md`, plus four user-reported fixes along the way.

## User-reported fixes

- **Highlight icon invisible in the selection menu** — the ported
  `ic_highlight_color` vector is white-filled with a gray Android tint;
  CMP's untinted `Image` rendered it blank. Swapped for the theme-tinted
  material Highlight icon.
- **Font size dialog did nothing** — `-webkit-text-size-adjust` is a
  non-inherited property and nearly every site resets it on `body`, so the
  html-only rule never applied. The CSS now targets `html, body` with
  `!important`.
- **x.com bounced to Safari** — sites redirect through app schemes
  (`twitter://` etc.); the navigation delegate handed anything non-web to
  `UIApplication.openURL` silently. Every external-scheme hand-off now asks
  via the ok/cancel dialog first: nothing leaves EinkBro without consent.
- **URL input bar position** — now anchors at the toolbar edge like
  Android's InputBarDelegate (bottom toolbar → input at the bottom).

## Implemented from the audit list

Locale picker (ships zh-TW/zh-CN/ja/de/fr/es/ko string packs; sets
AppleLanguages, applied on relaunch), PDF paper-size picker + paginated
export through `UIPrintPageRenderer` (was a single-page snapshot), scroll
auto-hide toolbar with Back-restores-toolbar-first, live pull-to-refresh
re-wiring, geolocation stubbed to PERMISSION_DENIED when sharing is off,
file-URL access via WebKit's KVC keys, SHOW_RECENT_BOOKMARKS rendering
Android's card page (asset ported), reader-mode font size/family pickers,
zoom-text-reflow JS, and the vertical toolbar — the rail composable had been
ported all along; BrowserScreen just never used it. The pane area is now
wrapped in a Row with the rail on the chosen side.

## Removed or documented

Per user decision the e-ink image adjustment item (no iOS device has e-ink)
and the vi-binding item were removed outright. Documented as
platform-blocked: dual captions (Android intercepts caption requests with
`shouldInterceptRequest`, which WKWebView lacks — needs a JS fetch-hook
redesign), drag-URL-to-action (no clean WKWebView drag-drop mapping), and
form autofill (iOS system autofill has no per-app switch).
