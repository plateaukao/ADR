# EinkBro: App Startup and WebView Creation Performance

**Date:** 2026-04-06
**Commit:** 53cbbc4a on main
**Scope:** Bug fix in BaseWebConfig, user agent caching, tab restore optimization, memory pressure handling

---

## Problem

Investigation of the app startup path and WebView instance lifecycle revealed several performance issues and a correctness bug:

1. **`loadDomains()` bug in BaseWebConfig** — The method hardcodes `RecordUnit.TABLE_WHITELIST` instead of using the subclass's `dbTable` field. This means all three subclasses (`AdBlock`, `Javascript`, `Cookie`) load from the same `WHITELIST` table. Consequences:
   - `Cookie.isWhite(url)` and `Javascript.isWhite(url)` check against the ad-block whitelist, not their own tables (`COOKIE`, `JAVASCRIPT`). Users who whitelist a domain for cookies don't actually get cookies accepted for it — the check passes only if the domain happens to also be in the ad-block whitelist.
   - Three identical SQLite queries run on the main thread during Koin singleton initialization at app startup, adding redundant I/O.

2. **User agent string fetched per-WebView** — `WebSettings.getDefaultUserAgent(context)` is called inside `updateUserAgentString()`, which runs in every `EBWebView` constructor via `initPreferences()`. This is an expensive synchronous call to the Chromium engine that returns the same value every time. With 10 saved tabs, it runs 10 times on the main thread during startup.

3. **Wasteful preloading during tab restoration** — When restoring N saved tabs, `addAlbum()` is called N times in a loop. Each call (except the first) consumes the preloaded WebView and schedules a new preload 500ms later. During a batch restore of 10 tabs, this creates ~9 throwaway preloaded WebViews that are immediately consumed by the next iteration, wasting CPU cycles on unnecessary WebView construction.

4. **No memory pressure handling** — The app has no `onTrimMemory()` override. When the system signals memory pressure, background tabs continue consuming memory. With many open tabs, this can lead to the system killing the process rather than the app gracefully reducing its footprint.

---

## Root Cause

1. **`loadDomains()` copy-paste error** — `BaseWebConfig.loadDomains()` was written with a hardcoded table name `RecordUnit.TABLE_WHITELIST` rather than using the abstract `dbTable` property. The `getDomains()` method (used by the UI) correctly uses `dbTable`, but `loadDomains()` (used at init) does not. This means the internal whitelist used for runtime `isWhite()` checks has always been wrong for Cookie and Javascript configs.

2. **No caching of user agent** — `WebSettings.getDefaultUserAgent(context)` does not cache its result internally (it queries the Chromium WebView provider each time). The code also applies regex replacements (removing "wv" and version strings) on every call. There was no application-level cache.

3. **`addAlbum()` always preloads** — The `enablePreloadWebView` parameter defaults to `true`. During the `initSavedTabs()` loop, no special handling existed to suppress preloading for intermediate iterations.

4. **Missing lifecycle callback** — `onTrimMemory()` was simply not overridden in `BrowserActivity`.

---

## Solution

### 1. Fix `loadDomains()` to use `dbTable`

**BaseWebConfig.kt:104** — Changed `recordDb.listDomains(RecordUnit.TABLE_WHITELIST)` to `recordDb.listDomains(dbTable)`.

Now each subclass correctly loads its own whitelist:
- `AdBlock` loads from `WHITELIST` table
- `Javascript` loads from `JAVASCRIPT` table
- `Cookie` loads from `COOKIE` table

This fixes the correctness bug where `Cookie.isWhite()` and `Javascript.isWhite()` were checking against the wrong table, and eliminates 2 redundant identical DB queries at startup.

### 2. Cache default user agent string

**EBWebView.kt companion object** — Added a static `cachedDefaultUserAgent` field and a `getDefaultUserAgent(context)` method that computes the cleaned user agent string once, caches it, and returns the cached value on subsequent calls.

**EBWebView.updateUserAgentString()** — Changed to call `getDefaultUserAgent(context)` instead of `WebSettings.getDefaultUserAgent(context)` directly.

With 10 tabs, this eliminates 9 redundant calls to the Chromium engine + regex processing during startup.

### 3. Skip preloading during batch tab restore

**BrowserActivity.initSavedTabs()** — Added `enablePreloadWebView = (index == albumList.lastIndex)` to the `addAlbum()` call inside the tab restoration loop. Only the final tab in the batch triggers a preload; intermediate tabs skip it. This avoids creating and immediately consuming throwaway WebViews during the restore loop.

### 4. Add `onTrimMemory()` handler

**BrowserActivity** — Added `onTrimMemory(level)` override that activates at `TRIM_MEMORY_MODERATE` or higher:
- Pauses all background WebViews (calls `pauseWebView()` on each non-current tab)
- Destroys and releases the preloaded WebView

This gives the system back memory before it resorts to killing the process. The preloaded WebView will be recreated the next time a tab is opened.

---

## Key Files

| File | Changes |
|------|---------|
| `app/src/main/java/info/plateaukao/einkbro/browser/BaseWebConfig.kt` | Fixed `loadDomains()` to use `dbTable` instead of hardcoded `TABLE_WHITELIST` |
| `app/src/main/java/info/plateaukao/einkbro/view/EBWebView.kt` | Added `cachedDefaultUserAgent` + `getDefaultUserAgent()` in companion object; updated `updateUserAgentString()` to use cache |
| `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` | Added `onTrimMemory()` handler; disabled preloading during batch tab restore |

---

## Startup Path Analysis

The full app startup sequence was traced from `Application.onCreate()` through to first page render. Key findings for future reference:

### Application.onCreate() (EinkBroApplication.kt)
1. `startKoin` — creates all singletons eagerly:
   - `ConfigManager` — triggers `SharedPreferences` lazy init (XML parse from disk)
   - `RecordDb` — creates `RecordHelper` but database is lazy
   - `AdBlock`, `Javascript`, `Cookie` — each calls `BaseWebConfig.init()` which runs `loadDomains()` on the main thread (forces lazy database creation on first call) and `loadHosts()` on a background thread
   - `BookmarkManager`, `TtsManager`, `TtsNotificationManager`, etc.
2. `AppCompatDelegate.setDefaultNightMode`
3. `LocaleManager.setLocale` (if configured)
4. `setupAdBlock()` — creates `AdFilter` instance, starts background coroutine for filter downloads

### BrowserActivity.onCreate()
1. `MainActivityLayout.create()` — programmatic creation of ~25 views with ConstraintSet
2. `initToolbar/SearchPanel/InputBar/Overview/TouchArea` — UI setup
3. `dispatchIntent()` → `initSavedTabs()` — restores tabs:
   - Each `addAlbum()` call creates an `EBWebView` (or reuses preloaded one)
   - `EBWebView.init` runs `initWebView()`, `initWebSettings()`, `initPreferences()`
   - `initPreferences()` calls `updateUserAgentString()` → (now cached) `getDefaultUserAgent()`
   - Only foreground tab loads its URL immediately; background tabs defer to `initAlbumUrl`
4. Post-init: language label, touch area controller, translation/TTS viewmodels
5. `postDelayed(1000ms)` → `checkAdBlockerList()` — downloads default filters if needed

### Estimated main-thread timeline (10 saved tabs):
- Koin DI + database init: ~100-200ms
- Layout creation: ~100-200ms
- WebView creation (10 tabs): ~300-500ms (was ~500-800ms before UA caching + preload fix)
- First page load request sent: ~500-900ms after onCreate

---

## Lessons Learned

1. **Abstract methods exist for a reason — use them.** `BaseWebConfig` defines `dbTable` as an abstract property specifically so subclasses can specify their table. But `loadDomains()` ignored it and hardcoded the table name. This is a classic copy-paste error that's easy to miss because the code compiles fine and the `AdBlock` subclass (the most visible one) happens to use the hardcoded table. The `Cookie` and `Javascript` subclasses silently loaded wrong data.

2. **Cache expensive JNI/IPC calls.** `WebSettings.getDefaultUserAgent()` crosses into the Chromium WebView provider process and returns the same value every time for a given app. Calling it once and caching the result is a trivial optimization with measurable impact when multiplied by tab count.

3. **Batch operations need different defaults than single operations.** The preloading mechanism is well-designed for interactive use (user opens a tab, preload fires for the next one). But during batch tab restoration, preloading on every iteration creates and immediately consumes throwaway WebViews. The fix is simple: only preload on the last iteration.

4. **Always implement `onTrimMemory()` in memory-intensive apps.** A browser with multiple WebViews is inherently memory-hungry. Without `onTrimMemory()`, the system has no way to ask the app to reduce its footprint gracefully. The app goes straight from "full memory usage" to "process killed." Pausing background WebViews and releasing the preloaded one is a low-cost way to give memory back.
