# einkbro: blank page on io.google/2026 (dsd-pending hydration)

## Problem

Navigating to https://io.google/2026 in EinkBro rendered a completely blank
white WebView. The page title was set correctly ("Google I/O 2026") and
`onPageFinished` fired, but no content was visible.

## Root Cause

The site uses Google's Declarative Shadow DOM progressive-hydration pattern:

1. HTML ships with `<body dsd-pending>`
2. `assets/css/global.css` contains `[dsd-pending] { display: none; }`
3. A bootstrap script is supposed to remove the attribute once hydration
   completes, revealing the page.

Confirmed via Chrome DevTools Protocol against the live WebView:

- `document.body.hasAttribute("dsd-pending")` → true
- `getComputedStyle(body).display` → `none`
- Full HTML present (321KB, 3735 chars of text in the DOM)
- Forcing `body.style.display = 'block'` revealed a 4172px-tall fully-hydrated
  page
- All custom elements (`home-hero`, `lit-island`, etc.) were defined
- Chromium 146 natively supports DSD, so this was not a missing-feature issue

The hydration chain stalls because EinkBro's filters return 0-byte responses
for scripts the bootstrap pipeline depends on:

- `gstatic.com/glue/cookienotificationbar/cookienotificationbar.min.js`
  (blocked by adFilter — EasyList cosmetic/privacy list)
- `googletagmanager.com/gtm.js`, `gtag/js` (blocked by `ANALYTICS_DOMAINS`
  in `NinjaWebViewClient`)
- `apis.google.com/js/api.js` (blocked by adFilter)

When one of these fails, the async chain that removes `dsd-pending` never
reaches its final step, so the body stays permanently hidden.

## Solution

Inject a small script at `onPageFinished` that strips any `[dsd-pending]`
attributes from the document as a safety net. By onPageFinished the normal
hydration has had its chance to run; if the attribute is still present, the
chain is broken and we force the page visible.

Chose this over alternatives (whitelist io.google, loosen adblock, narrow
`gstatic/glue` rules) because:

- One-line, general — fixes any site using this hydration pattern
- Doesn't relax the ad/analytics filters
- No per-domain list to maintain

## Key Files

- `app/src/main/assets/fix_dsd_pending.js` — new, strips `[dsd-pending]`
- `app/src/main/java/info/plateaukao/einkbro/browser/NinjaWebViewClient.kt` —
  wired the injection into `onPageFinished` next to the existing
  `disable_video_autoplay.js` injection
- `app/src/main/java/info/plateaukao/einkbro/view/EBWebView.kt` — hosts
  `evaluateJsFile(...)` used to run the injection

## Lessons Learned

- A blank WebView with a correct title is almost always a CSS or hydration
  gate issue, not a network failure. Start with `getComputedStyle(body)` and
  `document.body.innerText.length`, not the network tab.
- Chrome DevTools Protocol via `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`
  is invaluable for diagnosing WebView issues. Note the origin check: raw
  WebSocket without an `Origin` header works; `curl`/most clients that set
  `Origin: http://localhost` get rejected with 403.
- Cosmetic/privacy filter lists often block Google's shared `gstatic.com/glue`
  UI bundles (cookie bars, material components) because the URLs pattern-match
  consent/tracking rules. This is collateral damage to watch for.
- Modern sites use progressive hydration patterns (DSD, `is-land`, Lit) where
  a single blocked dependency can hide the entire page. A defensive
  `[dsd-pending]` strip at `onPageFinished` is a cheap general safety net
  that beats per-domain allowlisting.
