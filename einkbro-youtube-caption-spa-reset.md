# einkbro: clear captured YouTube caption on SPA route changes

## Problem

YouTube captions captured for one video could leak into the next. When the
user opened video A with CC on, the player fetched a `timedtext` URL through
the WebView; `NinjaWebViewClient.shouldInterceptRequest` stashed that JSON in
`EBWebView.dualCaption`. If the user then clicked another video on YouTube,
the new video loaded via client-side routing — `loadUrl` was never called, so
`resetState()` never ran, so `dualCaption` stayed pinned to video A. Save-to-
epub, page-AI actions, and chat-with-web all consume `dualCaption` first when
present, so they would all silently use the wrong transcript.

## Root Cause

`dualCaption` is reset only inside `EBWebView.resetState()`, which is invoked
from `loadUrl` and `reload`. YouTube's SPA router triggers neither: it changes
the URL via `history.pushState`, which fires `WebViewClient.doUpdateVisited
History` but no full navigation lifecycle. Nothing in the codebase was
listening to that signal for caption state.

## Solution

Track the last URL seen by `doUpdateVisitedHistory`. When it differs from the
current call's URL, clear `dualCaption` — the user has navigated, and any
caption captured for the previous URL is stale.

To avoid wiping a caption that was just captured during the current page's
own load (full navigation flow: `onPageStarted` → `shouldInterceptRequest`
captures → `doUpdateVisitedHistory` fires with the same new URL), the
`lastVisitedHistoryUrl` tracker is reset to `null` in `onPageStarted`. That
way the trailing `doUpdateVisitedHistory(sameUrl)` after a fresh load is
treated as a starting point, not a transition.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/browser/NinjaWebViewClient.kt`
  - `lastVisitedHistoryUrl` field
  - URL-change check + clear in `doUpdateVisitedHistory`
  - reset to null in `onPageStarted`

## Lessons Learned

- WebView SPA navigation only surfaces through `doUpdateVisitedHistory`. Any
  per-page state stored from network interception or URL-bound capture must
  be invalidated there too, not just in `loadUrl`/`reload` paths.
- Resetting "last seen" trackers on `onPageStarted` is a clean way to make a
  cross-event invariant (clear when URL changes) coexist with full-load
  capture (don't clear what we just captured for the new URL).
- Active prefetch of YouTube captions when CC is off was attempted and pulled
  back: scraping `ytInitialPlayerResponse` from the loaded page didn't yield
  a usable caption track in practice, and the user preferred the simpler
  contract "turn CC on first."
