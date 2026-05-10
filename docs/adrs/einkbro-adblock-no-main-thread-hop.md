# einkbro: avoid main-thread hop on every subresource in ad-filter

## Problem

Page loads felt slow on E-ink. The WebView progress bar consistently paused at
10-15% for several seconds before advancing. While a large part of that window
is server-bound (TTFB for the main HTML), subresource loading was also being
throttled by a client-side bottleneck.

## Root Cause

`AdFilterImpl.shouldIntercept(WebView, WebResourceRequest)` ran every
subresource request through:

```kotlin
runBlocking {
    ...
    val documentUrl = withContext(Dispatchers.Main) { webView.url } ?: ...
    ...
}
```

Each subresource (image, CSS, script, XHR) was handed to
`WebViewClient.shouldInterceptRequest` on one of Chromium's network IO
threads. The ad-filter then **blocked that network thread** and dispatched to
the Android main thread just to read `webView.url`, then came back.

Consequences:

- While the main thread was busy with UI work during page init - layout,
  drawing, restoring state, other WebView callbacks - every subresource
  request queued up behind it.
- The built-in WebView thread pool is small. A handful of serialized
  main-thread hops per resource cascade into visible page-load latency on
  slower devices (E-ink tablets in particular).

## Solution

Cache the current main-frame URL per WebView and read it lock-free on the
network thread.

`ad-filter/src/main/java/io/github/edsuns/adfilter/impl/AdFilterImpl.kt`:

- Added `private val mainFrameUrls: MutableMap<WebView, String> =
  Collections.synchronizedMap(WeakHashMap())`. `WeakHashMap` keeps the table
  from leaking WebViews across tab closes; the `Collections.synchronizedMap`
  wrapper makes it safe to touch from IO threads.
- `shouldIntercept(WebView, WebResourceRequest)` no longer uses `runBlocking`
  or `withContext(Main)`. When `request.isForMainFrame`, it stores the URL in
  the cache and returns a pass-through `FilterResult`. Otherwise it looks up
  the cached document URL and filters synchronously.
- `performScript(webView, url)` (invoked from `onPageStarted`) refreshes the
  cache entry as a safety net for any code path where the main-frame
  `shouldInterceptRequest` is not observed.
- Removed now-unused imports (`runBlocking`, `withContext`, `Dispatchers`).

## Trade-offs / Caveats

- SPA navigations via `history.pushState` do not fire `onPageStarted` or a new
  main-frame `shouldInterceptRequest`, so the cached `documentUrl` stays at
  the last real navigation. This matches the practical behavior of the old
  code for near-term subresources and is acceptable for ad-block
  classification, which uses `documentUrl` mainly to resolve same-origin
  exceptions.
- If a WebView is replaced in place (rare), the cache will hold a stale entry
  until GC collects the weak key.

## Key Files

- `ad-filter/src/main/java/io/github/edsuns/adfilter/impl/AdFilterImpl.kt`
  - the single-file change.
- `app/src/main/java/info/plateaukao/einkbro/browser/NinjaWebViewClient.kt`
  - caller that passes each subresource through `adFilter.shouldIntercept`.
- `app/src/main/java/info/plateaukao/einkbro/view/EBWebView.kt` -
  `FAKE_PRE_PROGRESS = 5`, plus the `loadUrl` flow; useful context for
  reasoning about the observed 10-15% pause.

## Lessons Learned

- `runBlocking` inside a WebView callback is almost always wrong.
  `shouldInterceptRequest` is specifically documented as running off the UI
  thread; bouncing back to main for a trivial read reintroduces the
  serialization the threading model was designed to avoid.
- "Progress bar stuck at 10-15%" in WebView apps is mostly TTFB, but
  subresource stalls caused by blocking `shouldInterceptRequest` look very
  similar from the user's perspective because they delay the page's visible
  readiness (first paint / first meaningful paint), not the headline
  `onProgressChanged` number.
- `WeakHashMap` + `Collections.synchronizedMap` is a cheap, safe way to
  attach per-WebView state without touching View tags or inventing a
  subclass-level field.
