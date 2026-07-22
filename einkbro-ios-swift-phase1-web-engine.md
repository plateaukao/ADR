2026-07-22

# EinkBro iOS Swift rewrite — Phase 1 (web engine + minimal browser)

Phase 1 turns the Phase 0 foundation into an actual browser: a native
`WKWebViewEngine` and a minimal SwiftUI shell that loads pages, navigates, and
manages tabs. Installed over a prior Compose install it restores that install's
saved tabs and browses — verified in the simulator.

## What landed

- **`WebViewEngine` protocol** — a method-for-method port of the Kotlin
  interface, plus `WebViewEngineListener`. Both are `@MainActor`.
- **`WKWebViewEngine`** — wraps a WKWebView with the full delegate set:
  `WKNavigationDelegate` (finish/fail, `decidePolicyForNavigationAction` with the
  `einkbro://retry` error-page scheme, the `x-safari-*` escape-loop guard, non-web
  scheme hand-off, `*.user.js` install routing, split routing), `WKUIDelegate`
  (new-window + JS alert/confirm/prompt panels), server-trust and HTTP-basic auth
  challenges, KVO on `estimatedProgress`/`title`/`url`, Safari-complete user
  agent, content-rule blocking, JS-based paging, and pull-to-refresh.
- **`ContentBlocker`** (adblock + image + cookie + analytics `WKContentRuleList`s)
  and **`WebDataCleaner`**.
- **`Album` + `BrowserViewModel`** — tab CRUD, focus, per-tab engine map,
  load/search dispatch, tab persistence to `sp_saved_album_info`, and
  history-on-page-finish. Platform-free: engines are created through an injected
  `WebEngineFactory`.
- **`BrowserView`** — web pane, a fixed bottom toolbar (back / forward /
  refresh-stop / URL / tab count), a URL-and-search input sheet, and a progress
  bar.

## Two decisions worth recording

- **The engine is main-actor.** WebKit delivers its delegate callbacks on the
  main thread, but Swift's concurrency checker doesn't know that, so touching the
  `@MainActor` `Album`/view-model from a nonisolated delegate method is an error.
  Rather than sprinkle `nonisolated`/`assumeIsolated`, the `WebViewEngine` and
  `WebViewEngineListener` protocols and the `WKWebViewEngine` class are all
  `@MainActor` — which is what they actually are (UI objects driven from the main
  thread). This also makes `BrowserViewModel`'s listener conformance fall out for
  free, since it is already `@MainActor`.
- **Kotlin/Native scars were dropped, not copied.** The Kotlin engine polled
  progress with a 0.1s timer and implemented a single delegate method per ObjC
  selector family, both forced by Kotlin/Native interop limits. The Swift engine
  uses KVO for progress/title/url and implements the complete delegate set, as
  the porting guide's "do not copy" list prescribes.

## Platform isolation for the macOS goal

Every WebKit/UIKit-touching file (`WKWebViewEngine`, `ContentBlocker`,
`WebViewHost`, `BrowserView`, `EngineSetup`) is wrapped in
`#if canImport(UIKit) && canImport(WebKit)`, and the app installs the engine into
Core's `WebEngineFactory` seam at startup. So the `EinkBroKit` Core still builds
and unit-tests on the macOS host, and the eventual macOS target only needs to
supply an `NSViewRepresentable` host and its own factory — the view model and all
of Core are already platform-free.

## Verification

Installed over the existing Compose install (same bundle id, same data
container), the Swift app restored its 2 saved tabs, rendered the Google home
page, accepted a query in the page and navigated to the results, correctly
enabled the Back button only after there was history to go back to, and returned
to the home page when Back was tapped. Forward stayed disabled throughout. The 41
foundation tests remained green.

Deferred to Phase 3 (stubs/TODOs in place): the full `WKDownloadDelegate`,
JS-pull favicon fetching, the two-finger pan recognizer, and the custom
edit-menu suppression. Next: Phase 2 — the configurable toolbar, the 84-action
dispatcher, menus, and dialogs.
