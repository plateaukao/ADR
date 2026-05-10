# einkbro — WebView error page redesign

## Problem
When a page fails to load (offline, DNS failure, timeout, etc.), EinkBro
showed the default Android WebView error page: a generic Android bug
droid icon and raw Chromium error codes like `net::ERR_INTERNET_DISCONNECTED`.
That's ugly on E-ink, unbranded, and unfriendly to non-technical users.
There was also no easy way to retry once connectivity returned.

## Root Cause
`EBWebViewClient.onReceivedError` only logged the error (plus a special
case that downgrades `ERR_SSL_PROTOCOL_ERROR` from https to http). For
every other error, the WebView just kept whatever default page Chromium
renders, with no app-level override.

## Solution
Intercept main-frame errors and load a custom HTML page from assets:

1. `app/src/main/assets/error_page.html` — standalone page with:
   - EinkBro logo (copied launcher foreground to `assets/einkbro_logo.webp`
     so the HTML can reference it via `file:///android_asset/`).
   - Plain-language headline + reason (no error codes exposed).
   - Failed URL shown in small monospace text.
   - Rounded **Retry** button that navigates to `einkbro://retry`.
   - Canvas-based dragon-jump game (Chrome dino homage) — tap / Space to
     jump over rocks and cacti, speed ramps up every 10 points, best
     score persisted in `localStorage`.
   - Dark-mode aware, high-contrast styling for E-ink.

2. `EBWebViewClient.onReceivedError` now calls `showErrorPage()` for
   `request.isForMainFrame == true`, building a URL like
   `file:///android_asset/error_page.html?url=<encoded>&reason=<encoded>`.
   A `friendlyReason()` helper maps raw strings
   (`INTERNET_DISCONNECTED`, `NAME_NOT_RESOLVED`, `TIMED_OUT`, …) to
   human sentences. The SSL→HTTP fallback is preserved.

3. `EBWebViewClient.handleUri` intercepts `einkbro://retry` and calls
   `webView.loadUrl(lastFailedUrl)` (or `reload()` as a fallback).

## Key Files
- `app/src/main/assets/error_page.html` (new)
- `app/src/main/assets/einkbro_logo.webp` (new, copied from
  `res/mipmap-xxxhdpi/ic_launcher_foreground.webp`)
- `app/src/main/java/info/plateaukao/einkbro/browser/NinjaWebViewClient.kt`
  - New `lastFailedUrl` field
  - New `showErrorPage()` / `friendlyReason()` helpers
  - `onReceivedError` routes main-frame failures to the custom page
  - `handleUri` handles the `einkbro://retry` scheme

## Lessons Learned
- `file:///android_asset/` only serves files from `assets/`, not `res/`.
  Embedding drawables in a standalone HTML page requires copying them
  into `assets/` (or inlining as data URIs / SVG).
- `WebResourceRequest.isForMainFrame` is the right gate — without it,
  every failed sub-resource (tracker, favicon, ad) would trigger the
  error page and clobber a working page.
- Using a custom URL scheme (`einkbro://retry`) intercepted in
  `shouldOverrideUrlLoading` is a clean way to wire HTML buttons back to
  Kotlin without needing a JavaScript interface.
- For E-ink UIs, pull colors from `getComputedStyle(document.body)` so
  canvas drawings automatically respect the light/dark scheme chosen by
  the CSS.
