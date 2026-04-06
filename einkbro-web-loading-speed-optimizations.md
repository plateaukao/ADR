# EinkBro: Web Content Loading Speed Optimizations

**Date:** 2026-04-06
**Commit:** 871a14c1 on main
**Scope:** Bug fixes, caching, and new optimizations across the WebView loading pipeline

---

## Problem

EinkBro's web content loading had several inefficiencies and bugs that degraded page load speed, particularly on resource-constrained E-ink devices:

1. **HTTP headers silently broken** -- The `requestHeaders` HashMap in `EBWebView.kt` used Kotlin's `to` operator (which creates a `Pair`) instead of `put()`, so `DNT` and `Save-Data` headers were never actually inserted into the map. Servers never received the `Save-Data: on` signal, meaning the data-saving feature advertised in settings was completely non-functional.

2. **DOM storage wrongly disabled** -- `domStorageEnabled` was tied to the `enableRemoteAccess` preference, so users who disabled file:// access also lost `localStorage` and `sessionStorage`, breaking many modern websites and forcing unnecessary re-fetches of data that should have been cached client-side.

3. **No native autoplay prevention** -- The app relied solely on JavaScript injection (`disable_video_autoplay.js`) to prevent video autoplay. This races with media elements -- some videos could begin loading before the script executes. The native `mediaPlaybackRequiresUserGesture` WebView setting was never configured.

4. **E-ink image processing repeated on every load** -- When e-ink image adjustment is enabled, every image request triggers: HTTP fetch, bitmap decode, pixel-by-pixel gamma/saturation/contrast processing, Floyd-Steinberg dithering, and re-encoding. This entire pipeline re-runs even on back/forward navigation with no caching of processed results.

5. **No DNS prefetching** -- When a user reads a page, the browser does nothing to pre-resolve domains for links they might click next, adding 20-100ms per domain to the next navigation.

6. **No analytics/tracker script blocking** -- While the ad-filter blocks ad resources, analytics scripts (Google Analytics, GTM, Facebook Pixel, Hotjar, etc.) pass through. These are among the heaviest resources on modern pages, consuming bandwidth and CPU cycles that are precious on E-ink devices.

7. **Slow WebView preloading** -- The preloaded WebView for new tabs was created with a 2-second delay, meaning rapid tab creation paid the full WebView initialization cost.

---

## Root Cause

Each issue had a distinct root cause:

1. **Headers bug**: Kotlin `HashMap.apply { "key" to "value" }` creates `Pair` objects but does not insert them. The correct syntax is `put("key", "value")` or `this["key"] = "value"`. This has been broken since the headers were first added.

2. **DOM storage coupling**: A single boolean `config.enableRemoteAccess` was used to control both `allowFileAccessFromFileURLs` (correct) and `domStorageEnabled` (incorrect). These are unrelated WebView capabilities.

3. **Missing native setting**: `WebSettings.mediaPlaybackRequiresUserGesture` exists in the Android WebView API but was simply never set.

4. **No caching layer**: The `processEinkImageRequest()` method in `NinjaWebViewClient` had no caching mechanism. Every image request performed the full network + processing pipeline regardless of whether the same image had been processed before.

5-7. **Missing features**: DNS prefetch, analytics blocking, and faster preload timing were simply not implemented.

---

## Solution

### Bug Fixes (Items 1-3)

**EBWebView.kt:**
- Fixed `requestHeaders` HashMap: changed `"DNT" to "1"` to `put("DNT", "1")` and same for `Save-Data` header. Headers are now actually sent with every request.
- Changed `domStorageEnabled = config.enableRemoteAccess` to `domStorageEnabled = true`. DOM storage is now always available regardless of file access settings.
- Added `mediaPlaybackRequiresUserGesture = !config.enableVideoAutoplay` in `initPreferences()`. This is the native WebView mechanism and fires before any content loads, complementing the existing JS injection.

### E-ink Image Cache (Item 4)

**New file: `EinkImageCache.kt`** -- Two-tier cache:
- **Memory tier**: `android.util.LruCache` with 16MB limit, keyed by MD5 of `"$url|$strength"`. Provides instant cache hits for back/forward navigation and same-session revisits.
- **Disk tier**: Files in `cacheDir/eink_images/` with 50MB limit and LRU eviction. Survives process death and cold restarts.

**Integration in `NinjaWebViewClient.processEinkImageRequest()`:**
- Before fetching: checks `einkImageCache.get(url, strength)`. On hit, returns cached bytes directly as `WebResourceResponse`, skipping the entire network + processing pipeline.
- After processing: reads processed stream to `ByteArray`, stores via `einkImageCache.put()`, then wraps in `ByteArrayInputStream` for the response.

### DNS Prefetch (Item 5)

**New file: `dns_prefetch.js`** -- Injected via `WebContentPostProcessor.postProcess()` after page load:
- Extracts unique external domains from `<a href="http...">` elements on the page.
- Injects `<link rel="dns-prefetch" href="...">` into `<head>` for up to 20 domains.
- Runs after `onPageFinished` so it doesn't compete with initial page loading.

### Analytics/Tracker Blocking (Item 6)

**In `NinjaWebViewClient.shouldInterceptRequest()`:**
- Added fast substring check against 12 known analytics domains (Google Analytics, GTM, Facebook, Hotjar, Bing, Yandex, TikTok, LinkedIn, Mouseflow, Heap) *before* the more expensive ad-filter call.
- Returns empty `WebResourceResponse` to block matched requests.
- Gated by new `blockAnalytics` preference (default: false) so users opt in.

**ConfigManager additions:**
- `blockAnalytics` boolean preference with key `sp_block_analytics`

### Faster WebView Preloading (Item 7)

**BrowserActivity.kt:**
- Changed `postDelayed` timeout from 2000ms to 500ms in `maybeCreateNewPreloadWebView()`.

---

## Key Files

| File | Changes |
|------|---------|
| `app/src/main/java/info/plateaukao/einkbro/view/EBWebView.kt` | Fixed requestHeaders bug, domStorageEnabled, added mediaPlaybackRequiresUserGesture |
| `app/src/main/java/info/plateaukao/einkbro/browser/NinjaWebViewClient.kt` | Integrated EinkImageCache, added analytics blocking with domain list, added isAnalyticsUrl() |
| `app/src/main/java/info/plateaukao/einkbro/unit/EinkImageCache.kt` | **New** -- Two-tier LRU cache (memory 16MB + disk 50MB) |
| `app/src/main/assets/dns_prefetch.js` | **New** -- DNS prefetch injection for page links |
| `app/src/main/java/info/plateaukao/einkbro/browser/WebContentPostProcessor.kt` | Added dns_prefetch.js injection in postProcess() |
| `app/src/main/java/info/plateaukao/einkbro/preference/ConfigManager.kt` | Added blockAnalytics preference and K_BLOCK_ANALYTICS constant |
| `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` | Reduced preload WebView delay from 2000ms to 500ms |

---

## Lessons Learned

1. **Kotlin `to` in `HashMap.apply` is a silent bug.** The `to` infix function creates a `Pair` but does not insert it into the map. This compiles without warning and fails silently at runtime. Always use `put()` or `this["key"] = "value"` inside `HashMap.apply {}` blocks. Consider using `hashMapOf("key" to "value")` in the constructor instead, where `to` actually works as intended via `mapOf`/`hashMapOf` varargs.

2. **WebView settings that control unrelated features should not share a single preference.** `enableRemoteAccess` conflating file access with DOM storage caused websites to break for users who reasonably disabled file:// access. Each WebView capability should map to its own config flag or be unconditionally enabled when it's a web platform fundamental (like DOM storage).

3. **Always cache expensive transformations.** The e-ink image processing pipeline (decode, per-pixel LUT + dithering, re-encode) is CPU-intensive. Without caching, this cost is paid redundantly on every navigation. A simple two-tier cache with URL+strength as the key eliminates this for revisited images.

4. **Native WebView settings are preferable to JS injection for core behaviors.** `mediaPlaybackRequiresUserGesture` is applied before any content loads, while JS injection in `onPageStarted` races with the page's own scripts. The native setting is both more reliable and has zero runtime cost.

5. **Analytics scripts are distinct from ads.** Ad blockers focus on ad networks and tracking pixels, but analytics scripts (Google Analytics, GTM tag containers, Hotjar session replay) often pass through. A lightweight pre-filter with substring matching against known analytics domains can block these cheaply before invoking the full ad-filter engine.
